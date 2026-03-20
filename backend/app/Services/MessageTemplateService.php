<?php

namespace App\Services;

use App\Models\MessageTemplate;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Message Template Service
 *
 * Business logic for managing message templates.
 */
class MessageTemplateService
{
    /**
     * Get all templates for a user, optionally filtered by type.
     *
     * @param User $user
     * @param string|null $type Optional filter by type ('invitation' or 'message')
     * @return Collection
     */
    public function getUserTemplates(User $user, ?string $type = null): Collection
    {
        $query = $user->messageTemplates()->orderBy('created_at', 'desc');

        if ($type) {
            $query->where('type', $type);
        }

        return $query->get();
    }

    /**
     * Create a new message template.
     *
     * @param User $user
     * @param array $data
     * @return MessageTemplate
     */
    public function createTemplate(User $user, array $data): MessageTemplate
    {
        return $user->messageTemplates()->create([
            'name' => $data['name'],
            'type' => $data['type'],
            'content' => $data['content'],
            'subject' => $data['subject'] ?? null,
        ]);
    }

    /**
     * Update an existing message template.
     *
     * @param MessageTemplate $template
     * @param array $data
     * @return MessageTemplate
     */
    public function updateTemplate(MessageTemplate $template, array $data): MessageTemplate
    {
        $updateData = [
            'name' => $data['name'] ?? $template->name,
            'content' => $data['content'] ?? $template->content,
            // Note: type cannot be changed after creation
        ];

        // Include subject for email templates
        if (array_key_exists('subject', $data)) {
            $updateData['subject'] = $data['subject'];
        }

        $template->update($updateData);

        return $template->fresh();
    }

    /**
     * Delete a message template.
     *
     * @param MessageTemplate $template
     * @return bool
     */
    public function deleteTemplate(MessageTemplate $template): bool
    {
        return $template->delete();
    }

    /**
     * Get a single template by ID for a user.
     *
     * @param User $user
     * @param int $templateId
     * @return MessageTemplate|null
     */
    public function getUserTemplate(User $user, int $templateId): ?MessageTemplate
    {
        return $user->messageTemplates()->find($templateId);
    }

    /**
     * Bulk delete templates for a user.
     *
     * @param User $user
     * @param array $templateIds
     * @return int Number of templates deleted
     */
    public function bulkDelete(User $user, array $templateIds): int
    {
        return $user->messageTemplates()
            ->whereIn('id', $templateIds)
            ->delete();
    }
}
