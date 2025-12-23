<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Conversation Model
 *
 * Represents a LinkedIn message conversation/thread.
 */
class Conversation extends Model
{
    protected $fillable = [
        'user_id',
        'prospect_id',
        'linkedin_conversation_id',
        'participant_name',
        'participant_linkedin_id',
        'participant_profile_url',
        'participant_avatar_url',
        'participant_headline',
        'last_message_preview',
        'last_message_at',
        'is_unread',
        'unread_count',
        'last_synced_at',
    ];

    protected $casts = [
        'last_message_at' => 'datetime',
        'last_synced_at' => 'datetime',
        'is_unread' => 'boolean',
        'unread_count' => 'integer',
    ];

    /**
     * Get the user that owns the conversation.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the prospect associated with this conversation.
     */
    public function prospect(): BelongsTo
    {
        return $this->belongsTo(Prospect::class);
    }

    /**
     * Get all messages in this conversation.
     */
    public function messages(): HasMany
    {
        return $this->hasMany(LinkedInMessage::class)->orderBy('sent_at', 'asc');
    }

    /**
     * Get the latest message in this conversation.
     */
    public function latestMessage()
    {
        return $this->hasOne(LinkedInMessage::class)->latestOfMany('sent_at');
    }

    /**
     * Scope for unread conversations.
     */
    public function scopeUnread($query)
    {
        return $query->where('is_unread', true);
    }

    /**
     * Scope for ordering by latest message.
     */
    public function scopeLatestFirst($query)
    {
        return $query->orderBy('last_message_at', 'desc');
    }

    /**
     * Mark conversation as read.
     */
    public function markAsRead(): void
    {
        $this->update([
            'is_unread' => false,
            'unread_count' => 0,
        ]);

        // Also mark all messages as read
        $this->messages()->where('is_read', false)->update(['is_read' => true]);
    }
}
