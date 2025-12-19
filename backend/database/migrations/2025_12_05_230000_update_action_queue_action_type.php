<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * The new action types to support.
     */
    private array $actionTypes = [
        'send_connection_request',
        'send_message',
        'withdraw_request',
        'visit_profile',
        'visit',
        'invite',
        'message',
        'follow'
    ];

    /**
     * Run the migrations.
     *
     * Updates the action_type column to use the new action keys from CampaignAction.
     * Old values: send_connection_request, send_message, withdraw_request, visit_profile
     * New values: visit, invite, message, follow (plus legacy values for backwards compatibility)
     *
     * Note: For fresh installs, the original migration already includes all action types,
     * so this migration will detect that and skip the changes.
     */
    public function up(): void
    {
        // For fresh installs (where original migration has all types), skip this migration
        if ($this->columnAlreadyHasAllTypes()) {
            return;
        }

        // PostgreSQL: Create new enum type, alter column, drop old type
        $enumValues = "'" . implode("','", $this->actionTypes) . "'";

        DB::statement("CREATE TYPE action_type_new AS ENUM ({$enumValues})");
        DB::statement("ALTER TABLE action_queue ALTER COLUMN action_type TYPE action_type_new USING action_type::text::action_type_new");
        DB::statement("DROP TYPE IF EXISTS action_type_enum");
        DB::statement("ALTER TYPE action_type_new RENAME TO action_type_enum");
        DB::statement("ALTER TABLE action_queue ALTER COLUMN action_type SET DEFAULT 'visit'");
    }

    /**
     * Check if the column already has all the new action types.
     * This happens on fresh installs where the original migration was updated.
     */
    private function columnAlreadyHasAllTypes(): bool
    {
        try {
            // For PostgreSQL with Laravel's enum (CHECK constraint), check the constraint
            $result = DB::select("
                SELECT pg_get_constraintdef(c.oid) as constraint_def
                FROM pg_constraint c
                JOIN pg_class t ON c.conrelid = t.oid
                WHERE t.relname = 'action_queue'
                AND c.contype = 'c'
                AND pg_get_constraintdef(c.oid) LIKE '%action_type%'
            ");

            if (!empty($result)) {
                $constraint = $result[0]->constraint_def ?? '';
                return str_contains($constraint, 'visit') && str_contains($constraint, 'invite');
            }

            // If no constraint found, it's likely a fresh install with all types
            return true;
        } catch (\Exception $e) {
            // If we can't determine, proceed with migration
            return false;
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $oldTypes = ['send_connection_request', 'send_message', 'withdraw_request', 'visit_profile'];
        $enumValues = "'" . implode("','", $oldTypes) . "'";

        DB::statement("CREATE TYPE action_type_old AS ENUM ({$enumValues})");
        DB::statement("ALTER TABLE action_queue ALTER COLUMN action_type TYPE action_type_old USING action_type::text::action_type_old");
        DB::statement("DROP TYPE IF EXISTS action_type_enum");
        DB::statement("ALTER TYPE action_type_old RENAME TO action_type_enum");
        DB::statement("ALTER TABLE action_queue ALTER COLUMN action_type SET DEFAULT 'send_connection_request'");
    }
};
