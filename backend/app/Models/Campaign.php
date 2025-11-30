<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Campaign Model
 *
 * Represents an automation campaign for LinkedIn actions.
 * Campaigns define what actions to perform (e.g., send connection requests).
 * Each campaign belongs to a user and can contain multiple prospects.
 */
class Campaign extends Model
{
    /**
     * The table associated with the model.
     */
    protected $table = 'campaigns';

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'user_id',
        'name',
        'description',
        'type',
        'message_template',
        'status',
        'daily_limit',
        'start_time',
        'end_time',
        'total_prospects',
        'completed_actions',
        'failed_actions',
    ];

    /**
     * Get the attributes that should be cast.
     */
    protected function casts(): array
    {
        return [
            'start_time' => 'datetime:H:i:s',
            'end_time' => 'datetime:H:i:s',
            'total_prospects' => 'integer',
            'completed_actions' => 'integer',
            'failed_actions' => 'integer',
            'daily_limit' => 'integer',
        ];
    }

    /**
     * Get the user that owns this campaign.
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get all prospects in this campaign.
     *
     * Many-to-many relationship via campaign_prospects pivot table.
     */
    public function prospects()
    {
        return $this->belongsToMany(Prospect::class, 'campaign_prospects')
            ->withPivot('status', 'failure_reason', 'processed_at')
            ->withTimestamps();
    }

    /**
     * Get all actions in the queue for this campaign.
     */
    public function actionQueue()
    {
        return $this->hasMany(ActionQueue::class);
    }
}
