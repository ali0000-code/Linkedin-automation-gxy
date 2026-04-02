<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Add auth_key column for Chrome extension authentication.
     *
     * The auth_key is a 22-character random string that users copy from the web app
     * and paste into the Chrome extension to authenticate without OAuth.
     * Fixed length of 22 chars provides ~131 bits of entropy (sufficient for auth keys).
     *
     * Unique constraint enables O(1) lookup in the extensionAuth() endpoint.
     * Nullable initially so the migration doesn't fail on existing rows,
     * then backfilled for all existing users.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('auth_key', 22)->nullable()->unique()->after('is_active');
        });

        // Backfill: generate auth_key for all existing users that don't have one.
        // Uses cursor() for memory efficiency (processes one row at a time).
        foreach (\App\Models\User::whereNull('auth_key')->cursor() as $user) {
            $user->update(['auth_key' => Str::random(22)]);
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('auth_key');
        });
    }
};
