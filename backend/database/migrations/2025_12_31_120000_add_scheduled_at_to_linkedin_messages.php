<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Adds scheduled_at column for scheduling messages to be sent at a future time.
     */
    public function up(): void
    {
        Schema::table('linkedin_messages', function (Blueprint $table) {
            $table->timestamp('scheduled_at')->nullable()->after('status');
            $table->index(['status', 'scheduled_at']); // For efficient querying of due messages
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('linkedin_messages', function (Blueprint $table) {
            $table->dropIndex(['status', 'scheduled_at']);
            $table->dropColumn('scheduled_at');
        });
    }
};
