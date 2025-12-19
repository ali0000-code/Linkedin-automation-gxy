<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Crypt;

/**
 * GmailSetting Model
 *
 * Stores user's Gmail SMTP credentials for sending emails.
 * App password is encrypted at rest using Laravel's encryption.
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
