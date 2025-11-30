<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Creates the prospect_tag pivot table for many-to-many relationship.
     * Allows prospects to have multiple tags, and tags to have multiple prospects.
     */
    public function up(): void
    {
        Schema::create('prospect_tag', function (Blueprint $table) {
            $table->id();

            // Foreign keys
            $table->foreignId('prospect_id')->constrained()->onDelete('cascade');
            $table->foreignId('tag_id')->constrained()->onDelete('cascade');

            $table->timestamps();

            // Ensure a prospect can only have a tag once
            $table->unique(['prospect_id', 'tag_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('prospect_tag');
    }
};
