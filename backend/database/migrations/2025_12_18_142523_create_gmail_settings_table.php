<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Creates gmail_settings table for storing user Gmail SMTP credentials.
     * Each user can have one Gmail account connected for sending emails.
     */
    public function up(): void
    {
        Schema::create('gmail_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->onDelete('cascade');

            // Gmail credentials
            $table->string('email'); // Gmail address
            $table->text('app_password'); // Encrypted App Password

            // Verification status
            $table->boolean('is_verified')->default(false);
            $table->timestamp('last_verified_at')->nullable();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('gmail_settings');
    }
};
