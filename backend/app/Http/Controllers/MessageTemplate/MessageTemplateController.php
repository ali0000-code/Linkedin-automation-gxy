<?php

namespace App\Http\Controllers\MessageTemplate;

use App\Http\Controllers\Controller;
use App\Models\MessageTemplate;
use App\Services\MessageTemplateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Message Template Controller
 *
 * Handles CRUD operations for message templates.
 */
class MessageTemplateController extends Controller
{
    /**
     * The message template service instance.
     *
     * @var MessageTemplateService
     */
    protected MessageTemplateService $templateService;

    /**
     * Create a new controller instance.
     *
     * @param MessageTemplateService $templateService
     */
    public function __construct(MessageTemplateService $templateService)
    {
        $this->templateService = $templateService;
    }

    /**
     * Get all message templates for the authenticated user.
     *
     * Optional query parameter: type (invitation|message) to filter templates.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        $type = $request->query('type'); // Optional filter

        $templates = $this->templateService->getUserTemplates(
            $request->user(),
            $type
        );

        return response()->json([
            'templates' => $templates,
        ]);
    }

    /**
     * Create a new message template.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|in:invitation,message,email',
            'content' => 'required|string|max:10000',
            'subject' => 'required_if:type,email|nullable|string|max:255',
        ]);

        // Additional validation for invitation messages (300 char limit)
        if ($validated['type'] === 'invitation' && mb_strlen($validated['content']) > 300) {
            return response()->json([
                'message' => 'Invitation messages must be 300 characters or less',
                'errors' => [
                    'content' => ['Invitation messages have a 300 character limit']
                ]
            ], 422);
        }

        // Additional validation for direct messages (5000 char limit)
        if ($validated['type'] === 'message' && mb_strlen($validated['content']) > 5000) {
            return response()->json([
                'message' => 'Direct messages must be 5000 characters or less',
                'errors' => [
                    'content' => ['Direct messages have a 5000 character limit']
                ]
            ], 422);
        }

        $template = $this->templateService->createTemplate(
            $request->user(),
            $validated
        );

        return response()->json([
            'message' => 'Template created successfully',
            'template' => $template,
        ], 201);
    }

    /**
     * Get a single message template.
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $template = $this->templateService->getUserTemplate($request->user(), $id);

        if (!$template) {
            return response()->json([
                'message' => 'Template not found'
            ], 404);
        }

        return response()->json([
            'template' => $template,
        ]);
    }

    /**
     * Update an existing message template.
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $template = $request->user()->messageTemplates()->find($id);

        if (!$template) {
            return response()->json([
                'message' => 'Template not found'
            ], 404);
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'content' => 'sometimes|required|string|max:10000',
            'subject' => 'nullable|string|max:255',
        ]);

        // Additional validation for invitation messages (300 char limit)
        if (isset($validated['content']) && $template->type === 'invitation' && mb_strlen($validated['content']) > 300) {
            return response()->json([
                'message' => 'Invitation messages must be 300 characters or less',
                'errors' => [
                    'content' => ['Invitation messages have a 300 character limit']
                ]
            ], 422);
        }

        // Additional validation for direct messages (5000 char limit)
        if (isset($validated['content']) && $template->type === 'message' && mb_strlen($validated['content']) > 5000) {
            return response()->json([
                'message' => 'Direct messages must be 5000 characters or less',
                'errors' => [
                    'content' => ['Direct messages have a 5000 character limit']
                ]
            ], 422);
        }

        // Subject is required for email templates
        if ($template->type === 'email' && isset($validated['subject']) && empty($validated['subject'])) {
            return response()->json([
                'message' => 'Subject is required for email templates',
                'errors' => [
                    'subject' => ['Email templates require a subject line']
                ]
            ], 422);
        }

        $template = $this->templateService->updateTemplate($template, $validated);

        return response()->json([
            'message' => 'Template updated successfully',
            'template' => $template,
        ]);
    }

    /**
     * Delete a message template.
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $template = $request->user()->messageTemplates()->find($id);

        if (!$template) {
            return response()->json([
                'message' => 'Template not found'
            ], 404);
        }

        $this->templateService->deleteTemplate($template);

        return response()->json([
            'message' => 'Template deleted successfully',
        ]);
    }

    /**
     * Bulk delete message templates.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function bulkDelete(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'template_ids' => 'required|array',
            'template_ids.*' => 'required|integer|exists:message_templates,id',
        ]);

        $deleted = $this->templateService->bulkDelete(
            $request->user(),
            $validated['template_ids']
        );

        return response()->json([
            'message' => 'Templates deleted successfully',
            'deleted' => $deleted,
        ]);
    }
}
