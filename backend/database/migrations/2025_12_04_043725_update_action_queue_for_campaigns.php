<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('action_queue', function (Blueprint $table) {
            // Add campaign_id to link actions to campaigns
            $table->foreignId('campaign_id')->nullable()->after('prospect_id')->constrained()->onDelete('cascade');

            // Add campaign_prospect_id to link actions to campaign prospects
            $table->foreignId('campaign_prospect_id')->nullable()->after('campaign_id')->constrained()->onDelete('cascade');

            // Add campaign_step_id to link actions to specific campaign steps
            $table->foreignId('campaign_step_id')->nullable()->after('campaign_prospect_id')->constrained()->onDelete('cascade');

            // Add index for campaign_id
            $table->index('campaign_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('action_queue', function (Blueprint $table) {
            $table->dropIndex(['campaign_id']);
            $table->dropForeign(['campaign_id']);
            $table->dropColumn('campaign_id');
            $table->dropForeign(['campaign_prospect_id']);
            $table->dropColumn('campaign_prospect_id');
            $table->dropForeign(['campaign_step_id']);
            $table->dropColumn('campaign_step_id');
        });
    }
};
