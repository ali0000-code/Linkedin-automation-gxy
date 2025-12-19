<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * The action types including email type.
     */
    private array $actionTypes = [
        'send_connection_request',
        'send_message',
        'withdraw_request',
        'visit_profile',
        'visit',
        'invite',
        'message',
        'follow',
        'email'  // Email action: extract email from profile and send
    ];

    /**
     * Run the migrations.
     *
     * Adds 'email' to the action_type CHECK constraint in action_queue table.
     */
    public function up(): void
    {
        // Check if 'email' type already exists in the constraint
        if ($this->hasEmailType()) {
            return;
        }

        // PostgreSQL: Update the CHECK constraint to include 'email'
        $types = array_map(fn($t) => "'{$t}'", $this->actionTypes);
        $typesString = implode(', ', $types);

        // Drop old constraint and add new one with 'email'
        DB::statement('ALTER TABLE action_queue DROP CONSTRAINT IF EXISTS action_queue_action_type_check');
        DB::statement("ALTER TABLE action_queue ADD CONSTRAINT action_queue_action_type_check CHECK (action_type::text = ANY (ARRAY[{$typesString}]::text[]))");
    }

    /**
     * Check if email type already exists in the constraint.
     */
    private function hasEmailType(): bool
    {
        try {
            $result = DB::select("
                SELECT pg_get_constraintdef(c.oid) as constraint_def
                FROM pg_constraint c
                JOIN pg_class t ON c.conrelid = t.oid
                WHERE t.relname = 'action_queue'
                AND c.contype = 'c'
                AND c.conname = 'action_queue_action_type_check'
            ");

            if (!empty($result)) {
                $constraint = $result[0]->constraint_def ?? '';
                return str_contains($constraint, "'email'");
            }

            return false;
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Remove 'email' from the constraint (recreate without it)
        $oldTypes = array_filter($this->actionTypes, fn($type) => $type !== 'email');
        $types = array_map(fn($t) => "'{$t}'", $oldTypes);
        $typesString = implode(', ', $types);

        // First delete any email actions
        DB::table('action_queue')->where('action_type', 'email')->delete();

        // Drop old constraint and add new one without 'email'
        DB::statement('ALTER TABLE action_queue DROP CONSTRAINT IF EXISTS action_queue_action_type_check');
        DB::statement("ALTER TABLE action_queue ADD CONSTRAINT action_queue_action_type_check CHECK (action_type::text = ANY (ARRAY[{$typesString}]::text[]))");
    }
};
