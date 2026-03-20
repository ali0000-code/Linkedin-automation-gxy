<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/**
 * User Model
 *
 * Represents a user account in the system.
 * Each user can have one LinkedIn account, multiple prospects, tags, and campaigns.
 */
class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable, HasApiTokens;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'linkedin_id',
        'name',
        'email',
        'profile_url',
        'profile_image_url',
        'oauth_access_token',
        'oauth_refresh_token',
        'token_expires_at',
        'is_active',
        'last_login_at',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'oauth_access_token',
        'oauth_refresh_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'token_expires_at' => 'datetime',
            'last_login_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    /**
     * Get the LinkedIn account associated with this user.
     *
     * Returns the connected LinkedIn profile (1-to-1 relationship).
     * A user can only have ONE LinkedIn account in MVP.
     */
    public function linkedInAccount()
    {
        return $this->hasOne(LinkedInAccount::class);
    }

    /**
     * Get all prospects belonging to this user.
     *
     * Returns all leads extracted by this user from LinkedIn.
     */
    public function prospects()
    {
        return $this->hasMany(Prospect::class);
    }

    /**
     * Get all tags created by this user.
     *
     * Tags are used to categorize prospects.
     */
    public function tags()
    {
        return $this->hasMany(Tag::class);
    }

    /**
     * Get all campaigns created by this user.
     *
     * Campaigns automate LinkedIn actions (e.g., sending connection requests).
     */
    public function campaigns()
    {
        return $this->hasMany(Campaign::class);
    }

    /**
     * Get all actions in the queue for this user.
     *
     * Actions are scheduled LinkedIn tasks to be performed by the extension.
     */
    public function actionQueue()
    {
        return $this->hasMany(ActionQueue::class);
    }

    /**
     * Get all message templates created by this user.
     *
     * Templates are reusable messages for campaigns (invitation or direct messages).
     */
    public function messageTemplates()
    {
        return $this->hasMany(MessageTemplate::class);
    }

    /**
     * Get the Gmail settings for this user.
     *
     * Gmail settings store SMTP credentials for sending emails.
     */
    public function gmailSetting()
    {
        return $this->hasOne(GmailSetting::class);
    }

    /**
     * Get all emails sent by this user.
     */
    public function sentEmails()
    {
        return $this->hasMany(SentEmail::class);
    }
}
