<?php

namespace App\Services;

use App\Models\User;
use App\Models\Prospect;
use App\Models\SentEmail;
use App\Models\Campaign;
use App\Models\ActionQueue;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Config;
use Symfony\Component\Mailer\Transport\Smtp\EsmtpTransport;
use Symfony\Component\Mailer\Mailer;
use Symfony\Component\Mime\Email;

/**
 * EmailService
 *
 * Handles sending emails to prospects using user's Gmail SMTP settings.
 */
class EmailService
{
    protected GmailSettingService $gmailSettingService;

    public function __construct(GmailSettingService $gmailSettingService)
    {
        $this->gmailSettingService = $gmailSettingService;
    }

    /**
     * Send an email to a prospect.
     *
     * @return array{success: bool, message: string, sent_email_id?: int}
     */
    public function sendEmail(
        User $user,
        Prospect $prospect,
        string $subject,
        string $body,
        ?Campaign $campaign = null,
        ?ActionQueue $actionQueue = null
    ): array {
        // Validate Gmail settings
        if (!$this->gmailSettingService->hasVerifiedGmail($user)) {
            return [
                'success' => false,
                'message' => 'Gmail is not configured or verified. Please set up Gmail in Settings.',
            ];
        }

        // Validate prospect has email
        if (!$prospect->hasEmail()) {
            return [
                'success' => false,
                'message' => 'Prospect does not have an email address.',
            ];
        }

        // Create sent email record (pending)
        $sentEmail = $this->createSentEmailRecord(
            $user,
            $prospect,
            $subject,
            $body,
            $campaign,
            $actionQueue
        );

        try {
            // Get Gmail settings
            $gmailSetting = $user->gmailSetting;

            // Create and configure transport
            // Port 587 uses STARTTLS (starts plain, upgrades to TLS)
            // Port 465 uses implicit SSL (direct TLS connection)
            $transport = new EsmtpTransport(
                'smtp.gmail.com',
                587,
                false // Use STARTTLS, not direct SSL
            );
            $transport->setUsername($gmailSetting->email);
            $transport->setPassword($gmailSetting->getDecryptedAppPassword());

            // Create mailer
            $mailer = new Mailer($transport);

            // Create email
            $email = (new Email())
                ->from($gmailSetting->email)
                ->to($prospect->email)
                ->subject($subject)
                ->html($this->formatBody($body))
                ->text(strip_tags($body));

            // Send email
            $mailer->send($email);

            // Mark as sent
            $sentEmail->markAsSent();

            \Log::info('Email sent successfully', [
                'user_id' => $user->id,
                'prospect_id' => $prospect->id,
                'to_email' => $prospect->email,
                'subject' => $subject,
            ]);

            return [
                'success' => true,
                'message' => 'Email sent successfully.',
                'sent_email_id' => $sentEmail->id,
            ];

        } catch (\Exception $e) {
            \Log::error('Failed to send email', [
                'user_id' => $user->id,
                'prospect_id' => $prospect->id,
                'to_email' => $prospect->email,
                'error' => $e->getMessage(),
            ]);

            // Mark as failed
            $sentEmail->markAsFailed($e->getMessage());

            return [
                'success' => false,
                'message' => 'Failed to send email: ' . $this->getReadableError($e->getMessage()),
                'sent_email_id' => $sentEmail->id,
            ];
        }
    }

    /**
     * Create a sent email record.
     */
    protected function createSentEmailRecord(
        User $user,
        Prospect $prospect,
        string $subject,
        string $body,
        ?Campaign $campaign = null,
        ?ActionQueue $actionQueue = null
    ): SentEmail {
        return SentEmail::create([
            'user_id' => $user->id,
            'prospect_id' => $prospect->id,
            'campaign_id' => $campaign?->id,
            'action_queue_id' => $actionQueue?->id,
            'to_email' => $prospect->email,
            'subject' => $subject,
            'body' => $body,
            'status' => SentEmail::STATUS_PENDING,
        ]);
    }

    /**
     * Format email body with proper HTML.
     */
    protected function formatBody(string $body): string
    {
        // Convert newlines to <br> tags
        $formatted = nl2br(e($body));

        // Wrap in basic HTML
        return <<<HTML
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
</head>
<body style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">
    {$formatted}
</body>
</html>
HTML;
    }

    /**
     * Personalize email content with prospect data.
     */
    public function personalizeContent(string $content, Prospect $prospect): string
    {
        $replacements = [
            '{firstName}' => $this->getFirstName($prospect->full_name),
            '{lastName}' => $this->getLastName($prospect->full_name),
            '{fullName}' => $prospect->full_name ?? '',
            '{email}' => $prospect->email ?? '',
            '{company}' => $prospect->company ?? '',
            '{headline}' => $prospect->headline ?? '',
            '{location}' => $prospect->location ?? '',
        ];

        return str_replace(
            array_keys($replacements),
            array_values($replacements),
            $content
        );
    }

    /**
     * Get first name from full name.
     */
    protected function getFirstName(?string $fullName): string
    {
        if (!$fullName) return '';
        $parts = explode(' ', trim($fullName));
        return $parts[0] ?? '';
    }

    /**
     * Get last name from full name.
     */
    protected function getLastName(?string $fullName): string
    {
        if (!$fullName) return '';
        $parts = explode(' ', trim($fullName));
        return count($parts) > 1 ? end($parts) : '';
    }

    /**
     * Get user-friendly error message.
     */
    protected function getReadableError(string $errorMessage): string
    {
        if (str_contains($errorMessage, 'Authentication')) {
            return 'Gmail authentication failed. Please check your credentials in Settings.';
        }

        if (str_contains($errorMessage, 'recipient')) {
            return 'Invalid recipient email address.';
        }

        if (str_contains($errorMessage, 'Connection')) {
            return 'Could not connect to Gmail. Please try again.';
        }

        return 'An error occurred while sending the email.';
    }

    /**
     * Get email statistics for a user.
     */
    public function getStats(User $user): array
    {
        $query = SentEmail::where('user_id', $user->id);

        return [
            'total' => (clone $query)->count(),
            'sent' => (clone $query)->sent()->count(),
            'failed' => (clone $query)->failed()->count(),
            'pending' => (clone $query)->pending()->count(),
            'today' => (clone $query)->today()->count(),
            'today_sent' => (clone $query)->today()->sent()->count(),
            'today_failed' => (clone $query)->today()->failed()->count(),
        ];
    }

    /**
     * Send a single queued email by SentEmail ID.
     */
    public function sendSingleEmail(User $user, SentEmail $sentEmail): array
    {
        // Verify ownership
        if ($sentEmail->user_id !== $user->id) {
            return [
                'success' => false,
                'message' => 'Email not found.',
            ];
        }

        // Check if already sent
        if ($sentEmail->status === SentEmail::STATUS_SENT) {
            return [
                'success' => false,
                'message' => 'Email has already been sent.',
            ];
        }

        // Validate Gmail settings
        if (!$this->gmailSettingService->hasVerifiedGmail($user)) {
            return [
                'success' => false,
                'message' => 'Gmail is not configured or verified. Please set up Gmail in Settings.',
            ];
        }

        // Validate email has content
        if (empty($sentEmail->subject) || empty($sentEmail->body)) {
            return [
                'success' => false,
                'message' => 'Email is missing subject or body. Please edit before sending.',
            ];
        }

        try {
            // Get Gmail settings
            $gmailSetting = $user->gmailSetting;

            // Create and configure transport
            // Port 587 uses STARTTLS (starts plain, upgrades to TLS)
            // Port 465 uses implicit SSL (direct TLS connection)
            $transport = new EsmtpTransport(
                'smtp.gmail.com',
                587,
                false // Use STARTTLS, not direct SSL
            );
            $transport->setUsername($gmailSetting->email);
            $transport->setPassword($gmailSetting->getDecryptedAppPassword());

            // Create mailer
            $mailer = new Mailer($transport);

            // Create email
            $email = (new Email())
                ->from($gmailSetting->email)
                ->to($sentEmail->to_email)
                ->subject($sentEmail->subject)
                ->html($this->formatBody($sentEmail->body))
                ->text(strip_tags($sentEmail->body));

            // Send email
            $mailer->send($email);

            // Mark as sent
            $sentEmail->markAsSent();

            \Log::info('Email sent successfully', [
                'user_id' => $user->id,
                'sent_email_id' => $sentEmail->id,
                'to_email' => $sentEmail->to_email,
            ]);

            return [
                'success' => true,
                'message' => 'Email sent successfully.',
            ];

        } catch (\Exception $e) {
            \Log::error('Failed to send email', [
                'user_id' => $user->id,
                'sent_email_id' => $sentEmail->id,
                'error' => $e->getMessage(),
            ]);

            $sentEmail->markAsFailed($e->getMessage());

            return [
                'success' => false,
                'message' => 'Failed to send email: ' . $this->getReadableError($e->getMessage()),
            ];
        }
    }

    /**
     * Send all pending emails for a user.
     */
    public function sendPendingEmails(User $user): array
    {
        // Validate Gmail settings first
        if (!$this->gmailSettingService->hasVerifiedGmail($user)) {
            return [
                'success' => false,
                'message' => 'Gmail is not configured or verified.',
                'sent' => 0,
                'failed' => 0,
            ];
        }

        $pendingEmails = SentEmail::where('user_id', $user->id)
            ->where('status', SentEmail::STATUS_PENDING)
            ->whereNotNull('subject')
            ->whereNotNull('body')
            ->get();

        $sent = 0;
        $failed = 0;

        foreach ($pendingEmails as $sentEmail) {
            $result = $this->sendSingleEmail($user, $sentEmail);
            if ($result['success']) {
                $sent++;
            } else {
                $failed++;
            }
        }

        return [
            'success' => true,
            'message' => "Sent {$sent} emails, {$failed} failed.",
            'sent' => $sent,
            'failed' => $failed,
        ];
    }

    /**
     * Send multiple emails by IDs.
     */
    public function sendBulkEmails(User $user, array $emailIds): array
    {
        // Validate Gmail settings first
        if (!$this->gmailSettingService->hasVerifiedGmail($user)) {
            return [
                'success' => false,
                'message' => 'Gmail is not configured or verified.',
                'sent' => 0,
                'failed' => 0,
            ];
        }

        $emails = SentEmail::where('user_id', $user->id)
            ->whereIn('id', $emailIds)
            ->whereIn('status', [SentEmail::STATUS_PENDING, 'draft'])
            ->whereNotNull('subject')
            ->whereNotNull('body')
            ->get();

        $sent = 0;
        $failed = 0;

        foreach ($emails as $sentEmail) {
            $result = $this->sendSingleEmail($user, $sentEmail);
            if ($result['success']) {
                $sent++;
            } else {
                $failed++;
            }
        }

        return [
            'success' => true,
            'message' => "Sent {$sent} emails, {$failed} failed.",
            'sent' => $sent,
            'failed' => $failed,
        ];
    }
}
