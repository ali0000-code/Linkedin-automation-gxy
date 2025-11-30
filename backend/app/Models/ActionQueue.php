<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * ActionQueue Model
 *
 * Represents a scheduled LinkedIn action to be performed by the Chrome extension.
 * When a campaign is activated, actions are generated here with scheduled times.
 * The extension polls this table and executes pending actions.
 */
class ActionQueue extends Model
{
    /**
     * The table associated with the model.
     */
    protected $table = 'action_queue';

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'user_id',
        'campaign_id',
        'prospect_id',
        'action_type',
        'action_data',
        'scheduled_for',
        'executed_at',
        'status',
        'result',
        'retry_count',
    ];

    /**
     * Get the attributes that should be cast.
     */
    protected function casts(): array
    {
        return [
            'scheduled_for' => 'datetime',
            'executed_at' => 'datetime',
            'retry_count' => 'integer',
        ];
    }

    /**
     * Get the user that owns this action.
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the campaign associated with this action.
     */
    public function campaign()
    {
        return $this->belongsTo(Campaign::class);
    }

    /**
     * Get the prospect this action is for.
     */
    public function prospect()
    {
        return $this->belongsTo(Prospect::class);
    }

    /**
     * Scope to get pending actions ready to be executed.
     *
     * Returns actions that are pending and scheduled for now or earlier.
     */
    public function scopeReadyToExecute($query)
    {
        return $query->where('status', 'pending')
            ->where('scheduled_for', '<=', now())
            ->orderBy('scheduled_for', 'asc');
    }
}
