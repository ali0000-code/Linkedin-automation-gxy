<?php

namespace App\Services;

use App\Models\GmailSetting;
use App\Models\User;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Config;

/**
 * GmailSettingService
 *
 * Handles Gmail SMTP settings for users.
 * Manages storage, retrieval, and verification of Gmail credentials.
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
        return GmailSetting::updateOrCreate(
            ['user_id' => $user->id],
            [
                'email' => $email,
                'app_password' => $appPassword, // Will be encrypted by model
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

            // Create a test transport to verify credentials
            // Port 587 uses STARTTLS (tls parameter = false, but encryption happens via STARTTLS)
            // Port 465 uses direct SSL (tls parameter = true)
            $transport = new \Symfony\Component\Mailer\Transport\Smtp\EsmtpTransport(
                'smtp.gmail.com',
                587,
                false // Don't use direct SSL, STARTTLS will be used automatically
            );

            $transport->setUsername($setting->email);
            $transport->setPassword($password);

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
            'port' => 587,
            'encryption' => 'tls',
            'username' => $setting->email,
            'password' => $setting->getDecryptedAppPassword(),
            'timeout' => 30,
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
