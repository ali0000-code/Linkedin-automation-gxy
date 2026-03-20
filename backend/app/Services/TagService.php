<?php

namespace App\Services;

use App\Models\Tag;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

/**
 * TagService
 *
 * Service class for handling tag business logic.
 * Tags are used to categorize prospects (e.g., "Hot Lead", "CEO", "Marketing").
 */
class TagService
{
    /**
     * Get all tags for a user.
     *
     * Includes prospect count for each tag.
     *
     * @param User $user
     * @return Collection
     */
    public function getTags(User $user): Collection
    {
        return Tag::where('user_id', $user->id)
            ->withCount('prospects') // Add prospects_count attribute
            ->orderBy('name', 'asc')
            ->get();
    }

    /**
     * Get a single tag by ID.
     *
     * Ensures the tag belongs to the authenticated user.
     *
     * @param int $tagId
     * @param User $user
     * @return Tag|null
     */
    public function getTag(int $tagId, User $user): ?Tag
    {
        return Tag::where('id', $tagId)
            ->where('user_id', $user->id)
            ->withCount('prospects')
            ->first();
    }

    /**
     * Create a new tag.
     *
     * @param User $user
     * @param array $data Tag data (name, color)
     * @return Tag
     */
    public function createTag(User $user, array $data): Tag
    {
        // Add user_id to the data
        $data['user_id'] = $user->id;

        // Set default color if not provided
        if (!isset($data['color'])) {
            $data['color'] = '#3b82f6'; // Default blue color
        }

        return Tag::create($data);
    }

    /**
     * Update an existing tag.
     *
     * @param Tag $tag
     * @param array $data Updated data (name, color)
     * @return Tag
     */
    public function updateTag(Tag $tag, array $data): Tag
    {
        $tag->update($data);
        return $tag->fresh(); // Reload from database
    }

    /**
     * Delete a tag.
     *
     * Also removes all prospect associations (cascade handled by pivot table).
     *
     * @param Tag $tag
     * @return bool
     */
    public function deleteTag(Tag $tag): bool
    {
        return $tag->delete();
    }

    /**
     * Check if a tag name already exists for the user.
     *
     * Used for validation to prevent duplicate tag names.
     *
     * @param User $user
     * @param string $name
     * @param int|null $excludeTagId Tag ID to exclude (for update validation)
     * @return bool
     */
    public function tagNameExists(User $user, string $name, ?int $excludeTagId = null): bool
    {
        $query = Tag::where('user_id', $user->id)
            ->where('name', $name);

        if ($excludeTagId) {
            $query->where('id', '!=', $excludeTagId);
        }

        return $query->exists();
    }
}
