<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Extends the action_queue table with campaign-specific foreign keys.
     * These columns are nullable because legacy actions may exist without campaigns.
     *
     * The three FKs together create a full traceability chain:
     *   action_queue -> campaign (which campaign this belongs to)
     *   action_queue -> campaign_prospect (which prospect-in-campaign context)
     *   action_queue -> campaign_step (which step in the campaign sequence)
     */
    public function up(): void
    {
        Schema::table('action_queue', function (Blueprint $table) {
            // Link action to its parent campaign
            $table->foreignId('campaign_id')->nullable()->after('prospect_id')->constrained()->onDelete('cascade');

            // Link to the specific campaign-prospect record (tracks per-prospect progress)
            $table->foreignId('campaign_prospect_id')->nullable()->after('campaign_id')->constrained()->onDelete('cascade');

            // Link to the specific campaign step (identifies which step this action executes)
            $table->foreignId('campaign_step_id')->nullable()->after('campaign_prospect_id')->constrained()->onDelete('cascade');

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
