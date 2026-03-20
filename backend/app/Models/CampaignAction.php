<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Campaign Action Model
 *
 * Represents a type of action that can be performed in campaigns (e.g., visit, invite, message, follow).
 * This is a registry table that defines what actions are available in the system.
 *
 * @property int $id
 * @property string $key Unique identifier (e.g., 'visit', 'invite', 'message', 'follow')
 * @property string $name Display name
 * @property string $description Action description
 * @property string|null $icon Icon identifier for UI
 * @property bool $requires_template Does this action require a message template?
 * @property bool $requires_connection Does this action require an existing connection?
 * @property array|null $config Additional configuration
 * @property bool $is_active Is this action type available?
 * @property int $order Display order in UI
 * @property \DateTime $created_at
 * @property \DateTime $updated_at
 */
class CampaignAction extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     */
    protected $table = 'campaign_actions';

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'key',
        'name',
        'description',
        'icon',
        'requires_template',
        'requires_connection',
        'config',
        'is_active',
        'order',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'requires_template' => 'boolean',
        'requires_connection' => 'boolean',
        'config' => 'array',
        'is_active' => 'boolean',
        'order' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Action key constants
     */
    const KEY_VISIT = 'visit';
    const KEY_INVITE = 'invite';
    const KEY_MESSAGE = 'message';
    const KEY_FOLLOW = 'follow';
    const KEY_EMAIL = 'email';

    /**
     * Get all campaign steps that use this action.
     */
    public function campaignSteps(): HasMany
    {
        return $this->hasMany(CampaignStep::class);
    }

    /**
     * Scope to get only active actions.
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope to order by display order.
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeOrdered($query)
    {
        return $query->orderBy('order');
    }

    /**
     * Check if this action requires a message template.
     *
     * @return bool
     */
    public function needsTemplate(): bool
    {
        return $this->requires_template;
    }

    /**
     * Check if this action requires an existing connection.
     *
     * @return bool
     */
    public function needsConnection(): bool
    {
        return $this->requires_connection;
    }
}
