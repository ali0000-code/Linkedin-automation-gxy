<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Campaign Step Model
 *
 * Represents a single step/action in a campaign sequence.
 * Each campaign can have multiple steps that execute in order with configurable delays.
 *
 * @property int $id
 * @property int $campaign_id
 * @property int $campaign_action_id
 * @property int $order Step order in sequence
 * @property int $delay_days Days to wait before this step (after previous step)
 * @property int|null $message_template_id Message template if applicable
 * @property array|null $config Step-specific configuration
 * @property \DateTime $created_at
 * @property \DateTime $updated_at
 */
class CampaignStep extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     */
    protected $table = 'campaign_steps';

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'campaign_id',
        'campaign_action_id',
        'order',
        'delay_days',
        'message_template_id',
        'config',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'campaign_id' => 'integer',
        'campaign_action_id' => 'integer',
        'order' => 'integer',
        'delay_days' => 'integer',
        'message_template_id' => 'integer',
        'config' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get the campaign that owns this step.
     */
    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class);
    }

    /**
     * Get the action type for this step.
     */
    public function action(): BelongsTo
    {
        return $this->belongsTo(CampaignAction::class, 'campaign_action_id');
    }

    /**
     * Get the message template for this step (if applicable).
     */
    public function messageTemplate(): BelongsTo
    {
        return $this->belongsTo(MessageTemplate::class);
    }

    /**
     * Get the action queue entries for this step.
     */
    public function actionQueue(): HasMany
    {
        return $this->hasMany(ActionQueue::class);
    }

    /**
     * Scope to order steps by their sequence order.
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeOrdered($query)
    {
        return $query->orderBy('order');
    }

    /**
     * Check if this step requires a message template.
     *
     * @return bool
     */
    public function needsTemplate(): bool
    {
        return $this->action && $this->action->requires_template;
    }

    /**
     * Check if this step requires an existing connection.
     *
     * @return bool
     */
    public function needsConnection(): bool
    {
        return $this->action && $this->action->requires_connection;
    }

    /**
     * Get the delay in days for this step.
     *
     * @return int
     */
    public function getDelay(): int
    {
        return $this->delay_days;
    }
}
