<?php

namespace App\Services;

use App\Models\Prospect;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Pagination\LengthAwarePaginator;

/**
 * ProspectService
 *
 * Service class for handling prospect (lead) business logic.
 * Manages CRUD operations, filtering, search, and bulk imports.
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
        $total = Prospect::where('user_id', $user->id)->count();
        $notConnected = Prospect::where('user_id', $user->id)
            ->where('connection_status', 'not_connected')->count();
        $pending = Prospect::where('user_id', $user->id)
            ->where('connection_status', 'pending')->count();
        $connected = Prospect::where('user_id', $user->id)
            ->where('connection_status', 'connected')->count();

        return [
            'total' => $total,
            'not_connected' => $notConnected,
            'pending' => $pending,
            'connected' => $connected,
        ];
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
        $prospects = Prospect::where('user_id', $user->id)
            ->whereIn('id', $prospectIds)
            ->get();

        foreach ($prospects as $prospect) {
            $prospect->tags()->syncWithoutDetaching($tagIds);
        }

        return $prospects->count();
    }
}
