<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Campaign Model
 *
 * Represents an automated LinkedIn campaign with multiple steps/actions.
 * Campaigns can have different statuses (draft, active, paused, completed, archived).
 *
 * @property int $id
 * @property int $user_id
 * @property string $name
 * @property string|null $description
 * @property string $status (draft|active|paused|completed|archived)
 * @property int $daily_limit
 * @property int $total_prospects
 * @property int $processed_prospects
 * @property int $success_count
 * @property int $failure_count
 * @property \DateTime|null $started_at
 * @property \DateTime|null $completed_at
 * @property \DateTime $created_at
 * @property \DateTime $updated_at
 * @property \DateTime|null $deleted_at
 */
class Campaign extends Model
{
    use HasFactory, SoftDeletes;

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
        'status',
        'emails_processed',
        'daily_limit',
        'tag_id', // For filtering prospects by tag (used by email action)
        'total_prospects',
        'processed_prospects',
        'success_count',
        'failure_count',
        'started_at',
        'completed_at',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'daily_limit' => 'integer',
        'total_prospects' => 'integer',
        'processed_prospects' => 'integer',
        'success_count' => 'integer',
        'failure_count' => 'integer',
        'emails_processed' => 'boolean',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * Campaign status constants
     */
    const STATUS_DRAFT = 'draft';
    const STATUS_ACTIVE = 'active';
    const STATUS_PAUSED = 'paused';
    const STATUS_COMPLETED = 'completed';
    const STATUS_ARCHIVED = 'archived';

    /**
     * Get all available campaign statuses.
     *
     * @return array
     */
    public static function getStatuses(): array
    {
        return [
            self::STATUS_DRAFT,
            self::STATUS_ACTIVE,
            self::STATUS_PAUSED,
            self::STATUS_COMPLETED,
            self::STATUS_ARCHIVED,
        ];
    }

    /**
     * Get the user that owns the campaign.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the tag used for filtering prospects in this campaign.
     */
    public function tag(): BelongsTo
    {
        return $this->belongsTo(Tag::class);
    }

    /**
     * Get the campaign steps for this campaign.
     */
    public function steps(): HasMany
    {
        return $this->hasMany(CampaignStep::class)->orderBy('order');
    }

    /**
     * Get the campaign prospects for this campaign.
     */
    public function campaignProspects(): HasMany
    {
        return $this->hasMany(CampaignProspect::class);
    }

    /**
     * Get the prospects associated with this campaign through campaign_prospects.
     */
    public function prospects(): BelongsToMany
    {
        return $this->belongsToMany(Prospect::class, 'campaign_prospects')
            ->withPivot('status', 'current_step', 'last_action_at', 'failure_reason')
            ->withTimestamps();
    }

    /**
     * Get the action queue entries for this campaign.
     */
    public function actionQueue(): HasMany
    {
        return $this->hasMany(ActionQueue::class);
    }

    /**
     * Get the sent emails for this campaign.
     */
    public function sentEmails(): HasMany
    {
        return $this->hasMany(SentEmail::class);
    }

    /**
     * Check if campaign is active.
     *
     * @return bool
     */
    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }

    /**
     * Check if campaign is paused.
     *
     * @return bool
     */
    public function isPaused(): bool
    {
        return $this->status === self::STATUS_PAUSED;
    }

    /**
     * Check if campaign is completed.
     *
     * @return bool
     */
    public function isCompleted(): bool
    {
        return $this->status === self::STATUS_COMPLETED;
    }

    /**
     * Check if campaign is draft.
     *
     * @return bool
     */
    public function isDraft(): bool
    {
        return $this->status === self::STATUS_DRAFT;
    }

    /**
     * Activate the campaign.
     *
     * @return bool
     */
    public function activate(): bool
    {
        $this->status = self::STATUS_ACTIVE;
        if (!$this->started_at) {
            $this->started_at = now();
        }
        return $this->save();
    }

    /**
     * Pause the campaign.
     *
     * @return bool
     */
    public function pause(): bool
    {
        $this->status = self::STATUS_PAUSED;
        return $this->save();
    }

    /**
     * Complete the campaign.
     *
     * @return bool
     */
    public function complete(): bool
    {
        $this->status = self::STATUS_COMPLETED;
        $this->completed_at = now();
        return $this->save();
    }

    /**
     * Archive the campaign.
     *
     * @return bool
     */
    public function archive(): bool
    {
        $this->status = self::STATUS_ARCHIVED;
        return $this->save();
    }

    /**
     * Increment the total prospects count.
     *
     * @param int $count
     * @return bool
     */
    public function incrementTotalProspects(int $count = 1): bool
    {
        $this->total_prospects += $count;
        return $this->save();
    }

    /**
     * Increment the processed prospects count.
     *
     * @param int $count
     * @return bool
     */
    public function incrementProcessedProspects(int $count = 1): bool
    {
        $this->processed_prospects += $count;
        return $this->save();
    }

    /**
     * Increment the success count.
     *
     * @param int $count
     * @return bool
     */
    public function incrementSuccessCount(int $count = 1): bool
    {
        $this->success_count += $count;
        return $this->save();
    }

    /**
     * Increment the failure count.
     *
     * @param int $count
     * @return bool
     */
    public function incrementFailureCount(int $count = 1): bool
    {
        $this->failure_count += $count;
        return $this->save();
    }

    /**
     * Get campaign progress percentage.
     *
     * @return float
     */
    public function getProgressPercentage(): float
    {
        if ($this->total_prospects === 0) {
            return 0;
        }
        return round(($this->processed_prospects / $this->total_prospects) * 100, 2);
    }

    /**
     * Get campaign success rate percentage.
     *
     * @return float
     */
    public function getSuccessRate(): float
    {
        if ($this->processed_prospects === 0) {
            return 0;
        }
        return round(($this->success_count / $this->processed_prospects) * 100, 2);
    }
}
