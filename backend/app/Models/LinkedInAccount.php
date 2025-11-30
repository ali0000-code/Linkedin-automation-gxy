<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * LinkedInAccount Model
 *
 * Represents a connected LinkedIn profile.
 * Each user can have exactly ONE LinkedIn account (1-to-1 relationship).
 * Stores encrypted session cookies for authenticating with LinkedIn.
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
        'cookies',
        'is_active',
        'last_synced_at',
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
            'last_synced_at' => 'datetime',
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
