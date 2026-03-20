<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * ActionQueue Model
 *
 * Represents a single scheduled LinkedIn action to be executed by the Chrome extension.
 *
 * When a campaign is activated, ActionQueueService::generateActionsForCampaign() bulk-inserts
 * rows here for every (prospect x step) combination. The extension polls GET /api/extension/actions/next
 * to pick up the oldest pending action whose scheduled_for <= now().
 *
 * Status flow:
 *   pending -> in_progress -> completed   (happy path)
 *   pending -> in_progress -> failed      (extension reports failure)
 *   in_progress -> pending                (stale action reset after 5 min timeout)
 *   pending -> failed                     (cancelled because a prior step for this prospect failed)
 *
 * Action types correspond to CampaignAction keys:
 *   visit   - Visit the prospect's LinkedIn profile
 *   invite  - Send a connection request (optionally with a note)
 *   message - Send a direct message (requires existing connection)
 *   follow  - Follow the prospect's profile
 *   email   - Send an email to the prospect's extracted email address
 *
 * action_data (JSON) carries step-specific payload like personalized message text,
 * template IDs, and conditional action configs (e.g., connect_message with fallbacks).
 *
 * retry_count tracks how many times this action has been retried (max 3).
 * On retry, the action is reset to pending with a 5-minute delay.
 *
 * Race condition handling: markInProgressAtomic() uses a WHERE status='pending'
 * guard to prevent two extension tabs from claiming the same action.
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
        'campaign_prospect_id',
        'campaign_step_id',
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
            'action_data' => 'array',
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
     * Get the campaign prospect this action is for.
     */
    public function campaignProspect()
    {
        return $this->belongsTo(CampaignProspect::class);
    }

    /**
     * Get the campaign step this action is for.
     */
    public function campaignStep()
    {
        return $this->belongsTo(CampaignStep::class);
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
