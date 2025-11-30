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

        // Filter by tag
        if (isset($filters['tag_id'])) {
            $query->whereHas('tags', function ($q) use ($filters) {
                $q->where('tags.id', $filters['tag_id']);
            });
        }

        // Search in name, company, headline
        if (isset($filters['search']) && !empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('full_name', 'LIKE', "%{$search}%")
                  ->orWhere('company', 'LIKE', "%{$search}%")
                  ->orWhere('headline', 'LIKE', "%{$search}%");
            });
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
}
