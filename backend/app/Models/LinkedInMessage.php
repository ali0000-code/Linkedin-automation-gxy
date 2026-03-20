<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * LinkedInMessage Model
 *
 * Represents an individual message within a LinkedIn conversation.
 */
class LinkedInMessage extends Model
{
    // Status constants
    const STATUS_SYNCED = 'synced';   // Imported from LinkedIn
    const STATUS_PENDING = 'pending'; // Queued to be sent
    const STATUS_SENT = 'sent';       // Successfully sent via extension
    const STATUS_FAILED = 'failed';   // Failed to send

    protected $table = 'linkedin_messages';

    // Status for scheduled messages
    const STATUS_SCHEDULED = 'scheduled';

    protected $fillable = [
        'conversation_id',
        'user_id',
        'linkedin_message_id',
        'content',
        'is_from_me',
        'sender_name',
        'sender_linkedin_id',
        'sent_at',
        'is_read',
        'status',
        'error_message',
        'scheduled_at',
    ];

    protected $casts = [
        'sent_at' => 'datetime',
        'scheduled_at' => 'datetime',
        'is_from_me' => 'boolean',
        'is_read' => 'boolean',
    ];

    /**
     * Get the conversation this message belongs to.
     */
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    /**
     * Get the user this message belongs to.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Scope for messages from me.
     */
    public function scopeFromMe($query)
    {
        return $query->where('is_from_me', true);
    }

    /**
     * Scope for messages from others.
     */
    public function scopeFromOthers($query)
    {
        return $query->where('is_from_me', false);
    }

    /**
     * Scope for pending messages (to be sent).
     */
    public function scopePending($query)
    {
        return $query->where('status', self::STATUS_PENDING);
    }

    /**
     * Scope for unread messages.
     */
    public function scopeUnread($query)
    {
        return $query->where('is_read', false);
    }

    /**
     * Scope for scheduled messages.
     */
    public function scopeScheduled($query)
    {
        return $query->where('status', self::STATUS_SCHEDULED)
            ->whereNotNull('scheduled_at');
    }

    /**
     * Scope for scheduled messages that are due to be sent.
     */
    public function scopeDueToSend($query)
    {
        return $query->where('status', self::STATUS_SCHEDULED)
            ->whereNotNull('scheduled_at')
            ->where('scheduled_at', '<=', now());
    }

    /**
     * Check if message is scheduled for future.
     */
    public function isScheduled(): bool
    {
        return $this->status === self::STATUS_SCHEDULED && $this->scheduled_at !== null;
    }

    /**
     * Check if scheduled message is due to be sent.
     */
    public function isDue(): bool
    {
        return $this->isScheduled() && $this->scheduled_at <= now();
    }
}
