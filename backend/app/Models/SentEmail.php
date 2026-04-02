<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Builder;

/**
 * SentEmail Model
 *
 * Tracks every email sent (or attempted) to prospects through the platform.
 *
 * Emails can originate from:
 * 1. Campaign email steps -- bulk-created when a campaign with an email action completes
 *    and the user triggers "queue from campaign" (campaign_id is set)
 * 2. Manual/custom emails -- created directly by the user (campaign_id is null)
 *
 * Status flow:
 *   draft   -> pending -> sent     (user edits draft, then sends)
 *   pending -> sent                (immediate send)
 *   pending -> failed              (SMTP error, recorded in error_message)
 *
 * The action_queue_id is nullable and links back to the campaign action that
 * triggered this email, enabling traceability from campaign -> action -> email.
 *
 * The sent_at timestamp records the actual send time (vs created_at which is
 * when the record was created, possibly as a draft).
 */
class SentEmail extends Model
{
    protected $fillable = [
        'user_id',
        'prospect_id',
        'campaign_id',
        'action_queue_id',
        'to_email',
        'subject',
        'body',
        'status',
        'sent_at',
        'error_message',
    ];

    protected $casts = [
        'sent_at' => 'datetime',
    ];

    // Status constants
    const STATUS_PENDING = 'pending';
    const STATUS_SENT = 'sent';
    const STATUS_FAILED = 'failed';

    /**
     * Get the user who sent this email.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the prospect this email was sent to.
     */
    public function prospect(): BelongsTo
    {
        return $this->belongsTo(Prospect::class);
    }

    /**
     * Get the campaign this email belongs to (if any).
     */
    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class);
    }

    /**
     * Get the action queue entry (if any).
     */
    public function actionQueue(): BelongsTo
    {
        return $this->belongsTo(ActionQueue::class);
    }

    /**
     * Scope: Filter by status.
     */
    public function scopeStatus(Builder $query, string $status): Builder
    {
        return $query->where('status', $status);
    }

    /**
     * Scope: Only sent emails.
     */
    public function scopeSent(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_SENT);
    }

    /**
     * Scope: Only failed emails.
     */
    public function scopeFailed(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_FAILED);
    }

    /**
     * Scope: Only pending emails.
     */
    public function scopePending(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_PENDING);
    }

    /**
     * Scope: Emails sent today.
     */
    public function scopeToday(Builder $query): Builder
    {
        return $query->whereDate('created_at', today());
    }

    /**
     * Mark the email as sent.
     */
    public function markAsSent(): void
    {
        $this->update([
            'status' => self::STATUS_SENT,
            'sent_at' => now(),
            'error_message' => null,
        ]);
    }

    /**
     * Mark the email as failed.
     */
    public function markAsFailed(string $errorMessage): void
    {
        $this->update([
            'status' => self::STATUS_FAILED,
            'error_message' => $errorMessage,
        ]);
    }
}
