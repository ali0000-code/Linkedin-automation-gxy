<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Creates the campaign_prospects pivot table with extra columns.
     * Links prospects to campaigns and tracks their individual status.
     * This is NOT a simple pivot - it has additional status tracking.
     */
    public function up(): void
    {
        Schema::create('campaign_prospects', function (Blueprint $table) {
            $table->id();

            // Foreign keys
            $table->foreignId('campaign_id')->constrained()->onDelete('cascade');
            $table->foreignId('prospect_id')->constrained()->onDelete('cascade');

            // Individual prospect status within this campaign
            $table->enum('status', [
                'pending',      // Not yet processed
                'queued',       // Action created in action_queue
                'completed',    // Action successfully performed
                'failed',       // Action failed
                'skipped'       // Skipped (e.g., already connected)
            ])->default('pending');

            // Tracking
            $table->text('failure_reason')->nullable(); // Why it failed (if status = failed)
            $table->timestamp('processed_at')->nullable(); // When the action was completed

            $table->timestamps();

            // Ensure a prospect can only be in a campaign once
            $table->unique(['campaign_id', 'prospect_id']);
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('campaign_prospects');
    }
};
