<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Makes prospect_id nullable to allow custom emails without a linked prospect.
     */
    public function up(): void
    {
        Schema::table('sent_emails', function (Blueprint $table) {
            // Drop the existing foreign key constraint
            $table->dropForeign(['prospect_id']);
        });

        Schema::table('sent_emails', function (Blueprint $table) {
            // Make prospect_id nullable
            $table->unsignedBigInteger('prospect_id')->nullable()->change();

            // Re-add the foreign key constraint with nullable support
            $table->foreign('prospect_id')
                ->references('id')
                ->on('prospects')
                ->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sent_emails', function (Blueprint $table) {
            $table->dropForeign(['prospect_id']);
        });

        Schema::table('sent_emails', function (Blueprint $table) {
            $table->foreignId('prospect_id')->change();
            $table->foreign('prospect_id')
                ->references('id')
                ->on('prospects')
                ->onDelete('cascade');
        });
    }
};
