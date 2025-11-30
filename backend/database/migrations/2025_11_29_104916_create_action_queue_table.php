<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Creates the action_queue table for scheduling automated LinkedIn actions.
     * When a campaign is activated, actions are generated here with scheduled times.
     * The Chrome extension polls this table and performs actions on LinkedIn.
     */
    public function up(): void
    {
        Schema::create('action_queue', function (Blueprint $table) {
            $table->id();

            // Foreign keys
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('campaign_id')->constrained()->onDelete('cascade');
            $table->foreignId('prospect_id')->constrained()->onDelete('cascade');

            // Action details
            $table->enum('action_type', [
                'send_connection_request',
                'send_message',
                'withdraw_request',
                'visit_profile'
            ])->default('send_connection_request');

            $table->text('action_data')->nullable(); // JSON data (e.g., message text)

            // Scheduling
            $table->timestamp('scheduled_for'); // When to execute this action
            $table->timestamp('executed_at')->nullable(); // When it was actually executed

            // Status tracking
            $table->enum('status', [
                'pending',      // Waiting to be executed
                'in_progress',  // Extension is currently doing it
                'completed',    // Successfully done
                'failed'        // Failed to execute
            ])->default('pending');

            $table->text('result')->nullable(); // Result message or error details
            $table->integer('retry_count')->default(0); // How many times we retried

            $table->timestamps();

            // Indexes for efficient queries
            $table->index(['status', 'scheduled_for']); // Find next pending actions
            $table->index('user_id');
            $table->index('campaign_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('action_queue');
    }
};
