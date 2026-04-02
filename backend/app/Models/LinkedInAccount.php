<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * LinkedInAccount Model
 *
 * Represents a connected LinkedIn profile (1:1 with User).
 *
 * This model stores two distinct types of LinkedIn credentials:
 * 1. Profile data from OAuth (linkedin_id, full_name, email, etc.)
 *    - Populated/updated during each OAuth callback
 * 2. Browser session cookies (cookies column)
 *    - Optionally stored by the extension for automation tasks
 *    - Encrypted at rest using Laravel's encrypt() helper
 *    - Separate from OAuth tokens because they serve different purposes:
 *      OAuth tokens are for API access, cookies are for browser-level automation
 *
 * Cookie management:
 * - cookies_valid tracks whether the stored cookies are still usable
 * - cookies_updated_at records when cookies were last refreshed
 * - last_synced_at records the last successful extension verification
 *
 * The cookies column is hidden from serialization to prevent accidental
 * exposure in API responses (defense in depth alongside encryption).
 */
class LinkedInAccount extends Model
{
    /**
     * The table associated with the model.
     */
    protected $table = 'linkedin_accounts';

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'user_id',
        'linkedin_id',
        'full_name',
        'profile_url',
        'email',
        'profile_image_url',
        'headline',
        'location',
        'cookies',
        'is_active',
        'cookies_valid',
        'last_synced_at',
        'cookies_updated_at',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * We hide cookies to prevent accidental exposure in API responses.
     */
    protected $hidden = [
        'cookies',
    ];

    /**
     * Get the attributes that should be cast.
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'cookies_valid' => 'boolean',
            'last_synced_at' => 'datetime',
            'cookies_updated_at' => 'datetime',
        ];
    }

    /**
     * Get the user that owns this LinkedIn account.
     *
     * Inverse of User->linkedInAccount() relationship.
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the encrypted cookies for LinkedIn authentication.
     *
     * Automatically decrypts the cookies when accessed.
     */
    public function getDecryptedCookiesAttribute()
    {
        return $this->cookies ? decrypt($this->cookies) : null;
    }

    /**
     * Set and encrypt the cookies.
     *
     * Automatically encrypts cookies before storing in database.
     */
    public function setEncryptedCookiesAttribute($value)
    {
        $this->attributes['cookies'] = $value ? encrypt($value) : null;
    }
}
