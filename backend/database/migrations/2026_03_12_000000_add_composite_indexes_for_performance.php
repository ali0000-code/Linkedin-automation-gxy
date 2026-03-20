<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add composite indexes for the most frequently queried patterns.
     *
     * action_queue (user_id, status, scheduled_for):
     *   Covers the extension's polling query: "get next pending action for this user
     *   where scheduled_for <= now()". Without this, every poll does a full table scan.
     *
     * campaign_prospects (campaign_id, status):
     *   Covers dashboard queries that count prospects by status within a campaign,
     *   and the campaign start flow that fetches pending prospects.
     */
    public function up(): void
    {
        Schema::table('action_queue', function (Blueprint $table) {
            $table->index(['user_id', 'status', 'scheduled_for'], 'action_queue_user_status_scheduled_index');
        });

        Schema::table('campaign_prospects', function (Blueprint $table) {
            $table->index(['campaign_id', 'status'], 'campaign_prospects_campaign_status_index');
        });
    }

    public function down(): void
    {
        Schema::table('action_queue', function (Blueprint $table) {
            $table->dropIndex('action_queue_user_status_scheduled_index');
        });

        Schema::table('campaign_prospects', function (Blueprint $table) {
            $table->dropIndex('campaign_prospects_campaign_status_index');
        });
    }
};
