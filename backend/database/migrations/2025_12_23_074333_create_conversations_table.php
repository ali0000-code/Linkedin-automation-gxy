<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Creates conversations table for storing LinkedIn message threads.
     */
    public function up(): void
    {
        Schema::create('conversations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('prospect_id')->nullable()->constrained()->onDelete('set null');

            // LinkedIn conversation identifier
            $table->string('linkedin_conversation_id')->nullable();

            // Participant info (the other person in the conversation)
            $table->string('participant_name');
            $table->string('participant_linkedin_id')->nullable();
            $table->string('participant_profile_url')->nullable();
            $table->string('participant_avatar_url')->nullable();
            $table->string('participant_headline')->nullable();

            // Conversation metadata
            $table->text('last_message_preview')->nullable();
            $table->timestamp('last_message_at')->nullable();
            $table->boolean('is_unread')->default(false);
            $table->integer('unread_count')->default(0);

            // Sync tracking
            $table->timestamp('last_synced_at')->nullable();

            $table->timestamps();

            // Indexes
            $table->index(['user_id', 'last_message_at']);
            $table->index(['user_id', 'is_unread']);
            $table->unique(['user_id', 'linkedin_conversation_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('conversations');
    }
};
