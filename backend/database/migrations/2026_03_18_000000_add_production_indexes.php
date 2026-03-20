<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Production indexes added after observing slow query logs.
     *
     * These cover the remaining high-frequency query patterns:
     * - prospect_tag: queried on every prospect list page (eager-loaded tags)
     * - message_templates: filtered by user + type in the campaign builder
     * - linkedin_accounts: looked up on every extension API call (1:1 with users)
     * - gmail_settings: looked up when sending emails (1:1 with users)
     *
     * The hasIndex() guard prevents duplicate index errors when re-running migrations.
     */
    public function up(): void
    {
        // prospect_tag pivot -- queried on every prospect list with tags
        Schema::table('prospect_tag', function (Blueprint $table) {
            $table->index('prospect_id', 'prospect_tag_prospect_index');
            $table->index('tag_id', 'prospect_tag_tag_index');
        });

        // message_templates — filtered by user + type
        Schema::table('message_templates', function (Blueprint $table) {
            $table->index(['user_id', 'type'], 'message_templates_user_type_index');
        });

        // linkedin_accounts — 1:1 with users, queried on every extension call
        if (!$this->hasIndex('linkedin_accounts', 'linkedin_accounts_user_id_unique')) {
            Schema::table('linkedin_accounts', function (Blueprint $table) {
                $table->unique('user_id', 'linkedin_accounts_user_id_unique');
            });
        }

        // gmail_settings — 1:1 with users
        if (!$this->hasIndex('gmail_settings', 'gmail_settings_user_id_unique')) {
            Schema::table('gmail_settings', function (Blueprint $table) {
                $table->unique('user_id', 'gmail_settings_user_id_unique');
            });
        }
    }

    public function down(): void
    {
        Schema::table('prospect_tag', function (Blueprint $table) {
            $table->dropIndex('prospect_tag_prospect_index');
            $table->dropIndex('prospect_tag_tag_index');
        });

        Schema::table('message_templates', function (Blueprint $table) {
            $table->dropIndex('message_templates_user_type_index');
        });

        if ($this->hasIndex('linkedin_accounts', 'linkedin_accounts_user_id_unique')) {
            Schema::table('linkedin_accounts', function (Blueprint $table) {
                $table->dropUnique('linkedin_accounts_user_id_unique');
            });
        }

        if ($this->hasIndex('gmail_settings', 'gmail_settings_user_id_unique')) {
            Schema::table('gmail_settings', function (Blueprint $table) {
                $table->dropUnique('gmail_settings_user_id_unique');
            });
        }
    }

    private function hasIndex(string $table, string $indexName): bool
    {
        $indexes = Schema::getIndexes($table);
        foreach ($indexes as $index) {
            if ($index['name'] === $indexName) {
                return true;
            }
        }
        return false;
    }
};
