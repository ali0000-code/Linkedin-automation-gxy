<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
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
