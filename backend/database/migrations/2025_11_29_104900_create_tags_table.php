<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Creates the tags table for categorizing prospects.
     * Users can create custom tags like "Hot Lead", "Marketing", "CEO", etc.
     * Many-to-many relationship with prospects via prospect_tag pivot table.
     */
    public function up(): void
    {
        Schema::create('tags', function (Blueprint $table) {
            $table->id();

            // Foreign key to users table (who owns this tag)
            $table->foreignId('user_id')->constrained()->onDelete('cascade');

            // Tag details
            $table->string('name'); // Tag name (e.g., "Hot Lead", "Marketing")
            $table->string('color')->default('#3b82f6'); // Hex color for UI display

            $table->timestamps();

            // Ensure unique tag names per user
            $table->unique(['user_id', 'name']);
            $table->index('user_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tags');
    }
};
