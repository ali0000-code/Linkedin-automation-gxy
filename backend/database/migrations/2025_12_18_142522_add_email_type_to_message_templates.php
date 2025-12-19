<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Adds email template support:
     * - Adds 'subject' column for email templates
     * - Updates 'type' enum to include 'email'
     */
    public function up(): void
    {
        Schema::table('message_templates', function (Blueprint $table) {
            // Add subject column for email templates
            $table->string('subject', 255)->nullable()->after('type');
        });

        // Update the type check constraint to include 'email'
        // PostgreSQL uses CHECK constraints for enums created by Laravel
        DB::statement("ALTER TABLE message_templates DROP CONSTRAINT IF EXISTS message_templates_type_check");
        DB::statement("ALTER TABLE message_templates ADD CONSTRAINT message_templates_type_check CHECK (type::text = ANY (ARRAY['invitation'::text, 'message'::text, 'email'::text]))");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Remove email templates first
        DB::table('message_templates')->where('type', 'email')->delete();

        Schema::table('message_templates', function (Blueprint $table) {
            $table->dropColumn('subject');
        });

        // Revert the type constraint
        DB::statement("ALTER TABLE message_templates DROP CONSTRAINT IF EXISTS message_templates_type_check");
        DB::statement("ALTER TABLE message_templates ADD CONSTRAINT message_templates_type_check CHECK (type::text = ANY (ARRAY['invitation'::text, 'message'::text]))");
    }
};
