<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Campaign Prospect Model
 *
 * Represents a prospect's participation in a campaign.
 * Tracks their progress through campaign steps and current status.
 *
 * @property int $id
 * @property int $campaign_id
 * @property int $prospect_id
 * @property string $status (pending|in_progress|completed|failed|skipped)
 * @property int $current_step Current step being executed (0 = not started)
 * @property \DateTime|null $last_action_at Last action executed time
 * @property string|null $failure_reason Reason if failed
 * @property \DateTime $created_at
 * @property \DateTime $updated_at
 */
class CampaignProspect extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     */
    protected $table = 'campaign_prospects';

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'campaign_id',
        'prospect_id',
        'status',
        'current_step',
        'last_action_at',
        'failure_reason',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'campaign_id' => 'integer',
        'prospect_id' => 'integer',
        'current_step' => 'integer',
        'last_action_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Status constants
     */
    const STATUS_PENDING = 'pending';
    const STATUS_IN_PROGRESS = 'in_progress';
    const STATUS_COMPLETED = 'completed';
    const STATUS_FAILED = 'failed';
    const STATUS_SKIPPED = 'skipped';

    /**
     * Get all available statuses.
     *
     * @return array
     */
    public static function getStatuses(): array
    {
        return [
            self::STATUS_PENDING,
            self::STATUS_IN_PROGRESS,
            self::STATUS_COMPLETED,
            self::STATUS_FAILED,
            self::STATUS_SKIPPED,
        ];
    }

    /**
     * Get the campaign this prospect belongs to.
     */
    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class);
    }

    /**
     * Get the prospect.
     */
    public function prospect(): BelongsTo
    {
        return $this->belongsTo(Prospect::class);
    }

    /**
     * Get the action queue entries for this campaign prospect.
     */
    public function actionQueue(): HasMany
    {
        return $this->hasMany(ActionQueue::class);
    }

    /**
     * Scope to get only pending campaign prospects.
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopePending($query)
    {
        return $query->where('status', self::STATUS_PENDING);
    }

    /**
     * Scope to get only in-progress campaign prospects.
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeInProgress($query)
    {
        return $query->where('status', self::STATUS_IN_PROGRESS);
    }

    /**
     * Scope to get only completed campaign prospects.
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeCompleted($query)
    {
        return $query->where('status', self::STATUS_COMPLETED);
    }

    /**
     * Scope to get only failed campaign prospects.
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeFailed($query)
    {
        return $query->where('status', self::STATUS_FAILED);
    }

    /**
     * Check if prospect is pending.
     *
     * @return bool
     */
    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }

    /**
     * Check if prospect is in progress.
     *
     * @return bool
     */
    public function isInProgress(): bool
    {
        return $this->status === self::STATUS_IN_PROGRESS;
    }

    /**
     * Check if prospect is completed.
     *
     * @return bool
     */
    public function isCompleted(): bool
    {
        return $this->status === self::STATUS_COMPLETED;
    }

    /**
     * Check if prospect has failed.
     *
     * @return bool
     */
    public function hasFailed(): bool
    {
        return $this->status === self::STATUS_FAILED;
    }

    /**
     * Mark prospect as in progress.
     *
     * @return bool
     */
    public function markInProgress(): bool
    {
        $this->status = self::STATUS_IN_PROGRESS;
        return $this->save();
    }

    /**
     * Mark prospect as completed.
     *
     * @return bool
     */
    public function markCompleted(): bool
    {
        $this->status = self::STATUS_COMPLETED;
        return $this->save();
    }

    /**
     * Mark prospect as failed.
     *
     * @param string $reason
     * @return bool
     */
    public function markFailed(string $reason): bool
    {
        $this->status = self::STATUS_FAILED;
        $this->failure_reason = $reason;
        return $this->save();
    }

    /**
     * Mark prospect as skipped.
     *
     * @return bool
     */
    public function markSkipped(): bool
    {
        $this->status = self::STATUS_SKIPPED;
        return $this->save();
    }

    /**
     * Advance to the next step.
     *
     * @return bool
     */
    public function advanceStep(): bool
    {
        $this->current_step++;
        $this->last_action_at = now();
        return $this->save();
    }

    /**
     * Update last action time.
     *
     * @return bool
     */
    public function updateLastActionTime(): bool
    {
        $this->last_action_at = now();
        return $this->save();
    }
}
