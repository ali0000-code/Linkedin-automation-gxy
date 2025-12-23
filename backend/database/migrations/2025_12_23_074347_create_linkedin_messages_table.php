<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Creates linkedin_messages table for storing individual messages within conversations.
     */
    public function up(): void
    {
        Schema::create('linkedin_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');

            // LinkedIn message identifier
            $table->string('linkedin_message_id')->nullable();

            // Message content
            $table->text('content');

            // Sender info
            $table->boolean('is_from_me')->default(false); // true if sent by user, false if received
            $table->string('sender_name')->nullable();
            $table->string('sender_linkedin_id')->nullable();

            // Timestamps
            $table->timestamp('sent_at')->nullable();
            $table->boolean('is_read')->default(false);

            // For queued outgoing messages
            $table->enum('status', ['synced', 'pending', 'sent', 'failed'])->default('synced');
            $table->text('error_message')->nullable();

            $table->timestamps();

            // Indexes
            $table->index(['conversation_id', 'sent_at']);
            $table->index(['user_id', 'status']);
            $table->unique(['conversation_id', 'linkedin_message_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('linkedin_messages');
    }
};
