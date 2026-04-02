<?php

namespace App\Services;

use App\Models\Prospect;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * ProspectService
 *
 * Service class for prospect (lead) business logic.
 *
 * Cache strategy: Prospect stats are cached for 60 seconds per user
 * (key: "prospect_stats_{user_id}"). The cache is busted on create,
 * update, delete, and bulk delete operations.
 *
 * Bulk import (used by Chrome extension):
 * - Deduplicates by profile_url (unique per user)
 * - Currently uses individual queries per prospect (acceptable for extension
 *   imports of 10-100 prospects; could be optimized for larger batches)
 *
 * Bulk attach tags (bulkAttachTags):
 * - Uses DB::table('prospect_tag')->insertOrIgnore() for O(1) duplicate handling
 *   instead of querying existing associations first
 * - Builds the full cross-product of (prospect_ids x tag_ids) pivot rows
 *
 * All operations are scoped to the authenticated user to prevent cross-user
 * data access.
 */
class ProspectService
{
    /**
     * Get all prospects for a user with optional filters and search.
     *
     * Supports filtering by:
     * - connection_status
     * - tags
     * - search query (name, company, headline)
     *
     * @param User $user The authenticated user
     * @param array $filters Optional filters (connection_status, tag_id, search)
     * @param int $perPage Number of items per page (default: 15)
     * @return LengthAwarePaginator
     */
    public function getProspects(User $user, array $filters = [], int $perPage = 15): LengthAwarePaginator
    {
        $query = Prospect::where('user_id', $user->id)
            ->with('tags'); // Eager load tags to avoid N+1 queries

        // Filter by connection status
        if (isset($filters['connection_status'])) {
            $query->where('connection_status', $filters['connection_status']);
        }

        // Filter by tag (single tag_id)
        if (isset($filters['tag_id'])) {
            $query->whereHas('tags', function ($q) use ($filters) {
                $q->where('tags.id', $filters['tag_id']);
            });
        }

        // Filter by multiple tags (tag_ids as comma-separated string)
        if (isset($filters['tag_ids']) && !empty($filters['tag_ids'])) {
            $tagIds = is_array($filters['tag_ids'])
                ? $filters['tag_ids']
                : explode(',', $filters['tag_ids']);

            $query->whereHas('tags', function ($q) use ($tagIds) {
                $q->whereIn('tags.id', $tagIds);
            });
        }

        // Search in full_name only
        if (isset($filters['search']) && !empty($filters['search'])) {
            $search = $filters['search'];
            $query->where('full_name', 'LIKE', "%{$search}%");
        }

        // Sort by newest first
        $query->orderBy('created_at', 'desc');

        return $query->paginate($perPage);
    }

    /**
     * Get a single prospect by ID.
     *
     * Ensures the prospect belongs to the authenticated user.
     *
     * @param int $prospectId
     * @param User $user
     * @return Prospect|null
     */
    public function getProspect(int $prospectId, User $user): ?Prospect
    {
        return Prospect::where('id', $prospectId)
            ->where('user_id', $user->id)
            ->with('tags')
            ->first();
    }

    /**
     * Create a new prospect.
     *
     * @param User $user The user who owns this prospect
     * @param array $data Prospect data (full_name, profile_url, etc.)
     * @return Prospect
     */
    public function createProspect(User $user, array $data): Prospect
    {
        // Add user_id to the data
        $data['user_id'] = $user->id;

        // Set default connection status if not provided
        if (!isset($data['connection_status'])) {
            $data['connection_status'] = 'not_connected';
        }

        Cache::forget("prospect_stats_{$user->id}");

        return Prospect::create($data);
    }

    /**
     * Bulk import prospects.
     *
     * Used by the Chrome extension to import multiple prospects at once.
     * Skips duplicates based on profile_url.
     *
     * @param User $user
     * @param array $prospects Array of prospect data
     * @return array ['created' => count, 'skipped' => count, 'prospects' => Collection]
     */
    public function bulkImport(User $user, array $prospects): array
    {
        $created = 0;
        $skipped = 0;
        $importedProspects = [];

        foreach ($prospects as $prospectData) {
            // Check if prospect already exists by profile_url
            $existing = Prospect::where('user_id', $user->id)
                ->where('profile_url', $prospectData['profile_url'])
                ->first();

            if ($existing) {
                $skipped++;
                continue;
            }

            // Create new prospect
            $prospect = $this->createProspect($user, $prospectData);
            $importedProspects[] = $prospect;
            $created++;
        }

        return [
            'created' => $created,
            'skipped' => $skipped,
            'prospects' => collect($importedProspects),
        ];
    }

    /**
     * Update an existing prospect.
     *
     * @param Prospect $prospect
     * @param array $data Updated data
     * @return Prospect
     */
    public function updateProspect(Prospect $prospect, array $data): Prospect
    {
        $prospect->update($data);
        Cache::forget("prospect_stats_{$prospect->user_id}");
        return $prospect->fresh(); // Reload from database
    }

    /**
     * Delete a prospect.
     *
     * Also removes all tag associations (cascade handled by database).
     *
     * @param Prospect $prospect
     * @return bool
     */
    public function deleteProspect(Prospect $prospect): bool
    {
        Cache::forget("prospect_stats_{$prospect->user_id}");
        return $prospect->delete();
    }

    /**
     * Attach tags to a prospect.
     *
     * @param Prospect $prospect
     * @param array $tagIds Array of tag IDs
     * @return Prospect
     */
    public function attachTags(Prospect $prospect, array $tagIds): Prospect
    {
        // sync() will add new tags and remove ones not in the array
        // To only add without removing, use attach() or syncWithoutDetaching()
        $prospect->tags()->syncWithoutDetaching($tagIds);
        return $prospect->fresh('tags');
    }

    /**
     * Detach a tag from a prospect.
     *
     * @param Prospect $prospect
     * @param int $tagId
     * @return Prospect
     */
    public function detachTag(Prospect $prospect, int $tagId): Prospect
    {
        $prospect->tags()->detach($tagId);
        return $prospect->fresh('tags');
    }

    /**
     * Get prospect statistics for a user.
     *
     * Returns counts by connection status.
     *
     * @param User $user
     * @return array
     */
    public function getStats(User $user): array
    {
        return Cache::remember("prospect_stats_{$user->id}", 60, function () use ($user) {
            $stats = Prospect::where('user_id', $user->id)
                ->selectRaw('COUNT(*) as total')
                ->selectRaw("SUM(CASE WHEN connection_status = 'not_connected' THEN 1 ELSE 0 END) as not_connected")
                ->selectRaw("SUM(CASE WHEN connection_status = 'pending' THEN 1 ELSE 0 END) as pending")
                ->selectRaw("SUM(CASE WHEN connection_status = 'connected' THEN 1 ELSE 0 END) as connected")
                ->first();

            return [
                'total' => (int) ($stats->total ?? 0),
                'not_connected' => (int) ($stats->not_connected ?? 0),
                'pending' => (int) ($stats->pending ?? 0),
                'connected' => (int) ($stats->connected ?? 0),
            ];
        });
    }

    /**
     * Bulk delete prospects.
     *
     * Deletes multiple prospects at once.
     * Only deletes prospects owned by the user.
     *
     * @param User $user
     * @param array $prospectIds Array of prospect IDs to delete
     * @return int Number of prospects deleted
     */
    public function bulkDelete(User $user, array $prospectIds): int
    {
        Cache::forget("prospect_stats_{$user->id}");
        return Prospect::where('user_id', $user->id)
            ->whereIn('id', $prospectIds)
            ->delete();
    }

    /**
     * Bulk attach tags to prospects.
     *
     * Attaches tags to multiple prospects at once.
     * Only updates prospects owned by the user.
     *
     * @param User $user
     * @param array $prospectIds Array of prospect IDs
     * @param array $tagIds Array of tag IDs to attach
     * @return int Number of prospects updated
     */
    public function bulkAttachTags(User $user, array $prospectIds, array $tagIds): int
    {
        $prospectIds = Prospect::where('user_id', $user->id)
            ->whereIn('id', $prospectIds)
            ->pluck('id')
            ->toArray();

        if (empty($prospectIds) || empty($tagIds)) {
            return 0;
        }

        // Build all pivot rows and insert, ignoring duplicates
        $pivotRows = [];
        $now = now();
        foreach ($prospectIds as $prospectId) {
            foreach ($tagIds as $tagId) {
                $pivotRows[] = [
                    'prospect_id' => $prospectId,
                    'tag_id' => $tagId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }

        // Insert and ignore duplicates (existing associations stay untouched)
        DB::table('prospect_tag')->insertOrIgnore($pivotRows);

        return count($prospectIds);
    }
}
