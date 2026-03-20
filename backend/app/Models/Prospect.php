<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Prospect Model
 *
 * Represents a LinkedIn lead extracted from search results by the Chrome extension.
 * Each prospect belongs to a single user (the one who extracted them).
 *
 * Prospects can be:
 * - Tagged with multiple labels (many-to-many via prospect_tag pivot)
 * - Added to multiple campaigns (many-to-many via campaign_prospects pivot)
 * - Targeted by action queue entries (the extension performs actions on their profile)
 * - Emailed if they have a known email address
 *
 * Connection statuses track the LinkedIn relationship lifecycle:
 * - not_connected: no relationship (default for freshly extracted prospects)
 * - pending: connection request sent, awaiting acceptance
 * - connected: mutual connection established
 * - withdrawn: connection request was withdrawn by the user
 *
 * The fillable list is intentionally minimal -- only fields that come from
 * LinkedIn scraping or that the user explicitly sets. Fields like headline,
 * company, location, and notes are stored in the DB but managed via migrations,
 * not listed in $fillable, because they are set through specific update flows.
 */
class Prospect extends Model
{
    /**
     * The table associated with the model.
     */
    protected $table = 'prospects';

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'user_id',
        'linkedin_id',
        'full_name',
        'profile_url',
        'profile_image_url',
        'email', // Extracted from LinkedIn contact info
        'connection_status',
    ];

    /**
     * Get the user that owns this prospect.
     *
     * The user who extracted this lead from LinkedIn.
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get all tags associated with this prospect.
     *
     * Many-to-many relationship via prospect_tag pivot table.
     */
    public function tags()
    {
        return $this->belongsToMany(Tag::class, 'prospect_tag')
            ->withTimestamps();
    }

    /**
     * Get all campaigns this prospect is part of.
     *
     * Many-to-many relationship via campaign_prospects pivot table.
     */
    public function campaigns()
    {
        return $this->belongsToMany(Campaign::class, 'campaign_prospects')
            ->withPivot('status', 'failure_reason', 'processed_at')
            ->withTimestamps();
    }

    /**
     * Get all actions in the queue for this prospect.
     *
     * Actions are scheduled tasks to be performed on this prospect's profile.
     */
    public function actionQueue()
    {
        return $this->hasMany(ActionQueue::class);
    }

    /**
     * Get all emails sent to this prospect.
     */
    public function sentEmails()
    {
        return $this->hasMany(SentEmail::class);
    }

    /**
     * Check if this prospect has an email address.
     */
    public function hasEmail(): bool
    {
        return !empty($this->email);
    }

    /**
     * Scope: Only prospects with email.
     */
    public function scopeWithEmail($query)
    {
        return $query->whereNotNull('email')->where('email', '!=', '');
    }

    /**
     * Scope: Only prospects without email.
     */
    public function scopeWithoutEmail($query)
    {
        return $query->where(function ($q) {
            $q->whereNull('email')->orWhere('email', '');
        });
    }
}
