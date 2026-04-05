<?php

namespace App\Services;

use App\Models\GmailSetting;
use App\Models\User;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Config;

/**
 * GmailSettingService
 *
 * Manages Gmail SMTP credential storage, verification, and configuration.
 *
 * This service is the single entry point for all Gmail-related operations.
 * It ensures credentials are always encrypted (via GmailSetting model mutator)
 * and provides a verification method that tests real SMTP connectivity.
 *
 * Verification approach: Instead of just validating the format, verifyConnection()
 * opens an actual SMTP connection to smtp.gmail.com:587, authenticates with the
 * stored credentials, then disconnects. This catches invalid passwords, blocked
 * accounts, and network issues before the user tries to send real emails.
 *
 * configureMailer() is available for scenarios where Laravel's Mail facade
 * needs to use the user's Gmail credentials (not currently used in production
 * since EmailService creates its own Symfony transport directly).
 */
class GmailSettingService
{
    /**
     * Get the user's Gmail settings.
     */
    public function getSettings(User $user): ?GmailSetting
    {
        return $user->gmailSetting;
    }

    /**
     * Save Gmail settings for a user.
     */
    public function saveSettings(User $user, string $email, string $appPassword): GmailSetting
    {
        // Gmail shows app passwords with spaces (xxxx xxxx xxxx xxxx) but SMTP
        // requires the 16-char password without spaces. Strip them automatically.
        $cleanPassword = preg_replace('/\s+/', '', $appPassword);

        return GmailSetting::updateOrCreate(
            ['user_id' => $user->id],
            [
                'email' => trim($email),
                'app_password' => $cleanPassword, // Will be encrypted by model
                'is_verified' => false,
            ]
        );
    }

    /**
     * Delete Gmail settings for a user.
     */
    public function deleteSettings(User $user): bool
    {
        $setting = $user->gmailSetting;

        if (!$setting) {
            return false;
        }

        return $setting->delete();
    }

    /**
     * Verify Gmail SMTP connection.
     *
     * Sends a test connection to Gmail's SMTP server.
     *
     * @return array{success: bool, message: string}
     */
    public function verifyConnection(User $user): array
    {
        $setting = $user->gmailSetting;

        if (!$setting) {
            return [
                'success' => false,
                'message' => 'Gmail settings not found. Please configure Gmail first.',
            ];
        }

        try {
            // Get decrypted password
            $password = $setting->getDecryptedAppPassword();

            if (!$password) {
                return [
                    'success' => false,
                    'message' => 'Could not decrypt App Password. Please re-enter your credentials.',
                ];
            }

            // Gmail supports port 465 (direct SSL) and 587 (STARTTLS).
            // Port 587 is often blocked by ISPs/firewalls, so use 465 with SSL.
            $transport = new \Symfony\Component\Mailer\Transport\Smtp\EsmtpTransport(
                'smtp.gmail.com',
                465,
                true // Direct SSL (port 465)
            );

            $transport->setUsername($setting->email);
            $transport->setPassword($password);

            // Set a short timeout so bad credentials fail fast
            $stream = $transport->getStream();
            if (method_exists($stream, 'setTimeout')) {
                $stream->setTimeout(10);
            }

            // Test the connection
            $transport->start();
            $transport->stop();

            // Mark as verified
            $setting->markAsVerified();

            return [
                'success' => true,
                'message' => 'Gmail connection verified successfully.',
            ];
        } catch (\Exception $e) {
            \Log::error('Gmail verification failed', [
                'user_id' => $user->id,
                'email' => $setting->email,
                'error' => $e->getMessage(),
            ]);

            $setting->markAsUnverified();

            // Provide user-friendly error messages
            $errorMessage = $this->getReadableError($e->getMessage());

            return [
                'success' => false,
                'message' => $errorMessage,
            ];
        }
    }

    /**
     * Configure Laravel mailer with user's Gmail settings.
     */
    public function configureMailer(GmailSetting $setting): void
    {
        Config::set('mail.mailers.gmail_user', [
            'transport' => 'smtp',
            'host' => 'smtp.gmail.com',
            'port' => 465,
            'encryption' => 'ssl',
            'username' => $setting->email,
            'password' => $setting->getDecryptedAppPassword(),
            'timeout' => 15,
        ]);
    }

    /**
     * Get user-friendly error message.
     */
    private function getReadableError(string $errorMessage): string
    {
        if (str_contains($errorMessage, 'Authentication')) {
            return 'Authentication failed. Please check your Gmail email and App Password.';
        }

        if (str_contains($errorMessage, 'Connection')) {
            return 'Could not connect to Gmail. Please check your internet connection.';
        }

        if (str_contains($errorMessage, 'timeout')) {
            return 'Connection timed out. Please try again.';
        }

        return 'Verification failed: ' . $errorMessage;
    }

    /**
     * Check if user has verified Gmail settings.
     */
    public function hasVerifiedGmail(User $user): bool
    {
        $setting = $user->gmailSetting;

        return $setting && $setting->is_verified;
    }
}
