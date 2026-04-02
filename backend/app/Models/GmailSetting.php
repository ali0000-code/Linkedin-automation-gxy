<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Crypt;

/**
 * GmailSetting Model (1:1 with User)
 *
 * Stores a user's Gmail SMTP credentials for sending emails to prospects.
 *
 * Encryption strategy:
 * - The app_password is encrypted using Laravel's Crypt::encryptString() via a
 *   custom mutator (setAppPasswordAttribute). This means the raw password never
 *   touches the database -- only the encrypted ciphertext is stored.
 * - Decryption happens on-demand via getDecryptedAppPassword() which gracefully
 *   handles decryption failures (e.g., if APP_KEY changes) by returning null.
 * - The app_password column is hidden from serialization as an extra safety layer.
 *
 * Verification flow:
 * 1. User saves email + app password via /api/settings/gmail
 * 2. User triggers verification via /api/settings/gmail/verify
 * 3. GmailSettingService opens a real SMTP connection to smtp.gmail.com:587
 * 4. On success, is_verified = true and last_verified_at is set
 * 5. Only verified Gmail settings can be used to send emails
 *
 * Note: This uses Google "App Passwords" (not OAuth), which requires the user
 * to have 2FA enabled on their Google account.
 */
class GmailSetting extends Model
{
    protected $fillable = [
        'user_id',
        'email',
        'app_password',
        'is_verified',
        'last_verified_at',
    ];

    protected $hidden = [
        'app_password', // Never expose encrypted password
    ];

    protected $casts = [
        'is_verified' => 'boolean',
        'last_verified_at' => 'datetime',
    ];

    /**
     * Get the user that owns the Gmail setting.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Set the app password (encrypts automatically).
     */
    public function setAppPasswordAttribute(string $value): void
    {
        $this->attributes['app_password'] = Crypt::encryptString($value);
    }

    /**
     * Get the decrypted app password.
     */
    public function getDecryptedAppPassword(): ?string
    {
        try {
            return Crypt::decryptString($this->attributes['app_password']);
        } catch (\Exception $e) {
            \Log::error('Failed to decrypt Gmail app password', [
                'user_id' => $this->user_id,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Mark the Gmail connection as verified.
     */
    public function markAsVerified(): void
    {
        $this->update([
            'is_verified' => true,
            'last_verified_at' => now(),
        ]);
    }

    /**
     * Mark the Gmail connection as unverified.
     */
    public function markAsUnverified(): void
    {
        $this->update([
            'is_verified' => false,
        ]);
    }
}
