<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Creates the campaigns table for automation campaigns.
     * Campaigns define what actions to perform (e.g., send connection requests).
     * Each campaign belongs to a user and can have multiple prospects.
     */
    public function up(): void
    {
        Schema::create('campaigns', function (Blueprint $table) {
            $table->id();

            // Foreign key to users table (who owns this campaign)
            $table->foreignId('user_id')->constrained()->onDelete('cascade');

            // Campaign details
            $table->string('name'); // Campaign name (e.g., "Outreach to CEOs")
            $table->text('description')->nullable(); // Optional description

            // Campaign type (MVP: only connection_request)
            $table->enum('type', ['connection_request'])->default('connection_request');

            // Message template for connection requests
            $table->text('message_template')->nullable(); // Optional message with connection request

            // Campaign status
            $table->enum('status', [
                'draft',      // Being created
                'active',     // Running
                'paused',     // Temporarily stopped
                'completed'   // Finished
            ])->default('draft');

            // Daily limits and scheduling
            $table->integer('daily_limit')->default(50); // Max actions per day
            $table->time('start_time')->default('09:00:00'); // Start sending at this time
            $table->time('end_time')->default('18:00:00'); // Stop sending at this time

            // Stats (will be updated as actions complete)
            $table->integer('total_prospects')->default(0); // Total prospects in campaign
            $table->integer('completed_actions')->default(0); // Successfully completed
            $table->integer('failed_actions')->default(0); // Failed attempts

            $table->timestamps();

            // Indexes for common queries
            $table->index('user_id');
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('campaigns');
    }
};
