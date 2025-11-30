<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Creates the linkedin_accounts table to store connected LinkedIn profiles.
     * Each user has exactly one LinkedIn account (1-to-1 relationship).
     * Stores encrypted cookies for authentication with LinkedIn.
     */
    public function up(): void
    {
        Schema::create('linkedin_accounts', function (Blueprint $table) {
            $table->id();

            // Foreign key to users table (1-to-1 relationship)
            $table->foreignId('user_id')->constrained()->onDelete('cascade');

            // LinkedIn profile information
            $table->string('linkedin_id')->unique()->nullable(); // LinkedIn's internal ID
            $table->string('full_name'); // Display name from LinkedIn
            $table->string('profile_url')->nullable(); // Public profile URL
            $table->string('email')->nullable(); // Email from LinkedIn
            $table->string('profile_image_url')->nullable(); // Profile picture URL

            // Authentication data (encrypted)
            $table->text('cookies')->nullable(); // Encrypted LinkedIn session cookies

            // Account status
            $table->boolean('is_active')->default(true); // Whether account is connected
            $table->timestamp('last_synced_at')->nullable(); // Last time we verified cookies work

            $table->timestamps();

            // Ensure one LinkedIn account per user
            $table->unique('user_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('linkedin_accounts');
    }
};
