<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Prospect Model
 *
 * Represents a LinkedIn lead extracted from search results.
 * Each prospect belongs to a user who extracted them.
 * Prospects can be tagged and added to campaigns.
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
        'headline',
        'profile_url',
        'location',
        'company',
        'profile_image_url',
        'connection_status',
        'notes',
        'last_contacted_at',
    ];

    /**
     * Get the attributes that should be cast.
     */
    protected function casts(): array
    {
        return [
            'last_contacted_at' => 'datetime',
        ];
    }

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
}
