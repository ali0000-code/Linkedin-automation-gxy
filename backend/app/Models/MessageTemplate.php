<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Message Template Model
 *
 * Represents a reusable message template for campaigns.
 * Three types: 'invitation' (connection request notes), 'message' (direct messages), and 'email'.
 */
class MessageTemplate extends Model
{
    // Template type constants
    const TYPE_INVITATION = 'invitation';
    const TYPE_MESSAGE = 'message';
    const TYPE_EMAIL = 'email';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'user_id',
        'name',
        'type',
        'subject', // For email templates
        'content',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get the user that owns the template.
     *
     * @return BelongsTo
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Scope a query to only include templates of a specific type.
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @param string $type
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeOfType($query, string $type)
    {
        return $query->where('type', $type);
    }

    /**
     * Scope a query to only include invitation templates.
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeInvitation($query)
    {
        return $query->where('type', 'invitation');
    }

    /**
     * Scope a query to only include direct message templates.
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeMessage($query)
    {
        return $query->where('type', 'message');
    }

    /**
     * Scope a query to only include email templates.
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeEmail($query)
    {
        return $query->where('type', 'email');
    }

    /**
     * Check if this is an email template.
     *
     * @return bool
     */
    public function isEmail(): bool
    {
        return $this->type === self::TYPE_EMAIL;
    }

    /**
     * Check if this template requires a subject.
     *
     * @return bool
     */
    public function requiresSubject(): bool
    {
        return $this->type === self::TYPE_EMAIL;
    }
}
