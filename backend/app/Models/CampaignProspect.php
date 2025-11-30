<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * CampaignProspect Model
 *
 * Pivot model for the many-to-many relationship between campaigns and prospects.
 * Tracks the status of each prospect within a campaign.
 * This is NOT a simple pivot - it has additional columns for status tracking.
 */
class CampaignProspect extends Model
{
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
        'failure_reason',
        'processed_at',
    ];

    /**
     * Get the attributes that should be cast.
     */
    protected function casts(): array
    {
        return [
            'processed_at' => 'datetime',
        ];
    }

    /**
     * Get the campaign associated with this record.
     */
    public function campaign()
    {
        return $this->belongsTo(Campaign::class);
    }

    /**
     * Get the prospect associated with this record.
     */
    public function prospect()
    {
        return $this->belongsTo(Prospect::class);
    }
}
