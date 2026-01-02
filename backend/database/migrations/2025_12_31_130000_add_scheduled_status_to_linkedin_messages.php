<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Adds 'scheduled' to the status enum for linkedin_messages.
     * Laravel creates CHECK constraints for enums in PostgreSQL.
     */
    public function up(): void
    {
        // Drop the existing check constraint and create a new one with 'scheduled'
        DB::statement("ALTER TABLE linkedin_messages DROP CONSTRAINT IF EXISTS linkedin_messages_status_check");
        DB::statement("ALTER TABLE linkedin_messages ADD CONSTRAINT linkedin_messages_status_check CHECK (status::text = ANY (ARRAY['synced'::text, 'pending'::text, 'sent'::text, 'failed'::text, 'scheduled'::text]))");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement("ALTER TABLE linkedin_messages DROP CONSTRAINT IF EXISTS linkedin_messages_status_check");
        DB::statement("ALTER TABLE linkedin_messages ADD CONSTRAINT linkedin_messages_status_check CHECK (status::text = ANY (ARRAY['synced'::text, 'pending'::text, 'sent'::text, 'failed'::text]))");
    }
};
