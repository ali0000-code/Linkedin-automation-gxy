<?php

namespace App\Http\Controllers\Campaign;

use App\Http\Controllers\Controller;
use App\Services\CampaignService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Campaign Controller
 *
 * Handles HTTP requests for campaign management.
 * Provides endpoints for CRUD operations and campaign lifecycle management.
 */
class CampaignController extends Controller
{
    /**
     * Campaign service instance
     */
    protected CampaignService $campaignService;

    /**
     * Constructor - inject campaign service
     */
    public function __construct(CampaignService $campaignService)
    {
        $this->campaignService = $campaignService;
    }

    /**
     * Get paginated list of campaigns with filters.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->only(['status', 'search', 'per_page', 'page']);
        $campaigns = $this->campaignService->getCampaigns($request->user(), $filters);

        return response()->json($campaigns);
    }

    /**
     * Get a single campaign by ID.
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $campaign = $this->campaignService->getCampaign($request->user(), $id);

        if (!$campaign) {
            return response()->json([
                'message' => 'Campaign not found'
            ], 404);
        }

        return response()->json([
            'campaign' => $campaign
        ]);
    }

    /**
     * Create a new campaign.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'daily_limit' => 'nullable|integer|min:1|max:100',
            'tag_id' => 'nullable|integer|exists:tags,id', // For filtering prospects by tag
            'steps' => 'nullable|array',
            'steps.*.campaign_action_id' => 'required|integer|exists:campaign_actions,id',
            'steps.*.delay_days' => 'nullable|integer|min:0',
            'steps.*.message_template_id' => 'nullable|integer|exists:message_templates,id',
            'steps.*.config' => 'nullable|array',
        ]);

        $campaign = $this->campaignService->createCampaign($request->user(), $validated);

        return response()->json([
            'message' => 'Campaign created successfully',
            'campaign' => $campaign
        ], 201);
    }

    /**
     * Update an existing campaign.
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'daily_limit' => 'nullable|integer|min:1|max:100',
            'steps' => 'nullable|array',
            'steps.*.campaign_action_id' => 'required|integer|exists:campaign_actions,id',
            'steps.*.delay_days' => 'nullable|integer|min:0',
            'steps.*.message_template_id' => 'nullable|integer|exists:message_templates,id',
            'steps.*.config' => 'nullable|array',
        ]);

        $campaign = $this->campaignService->updateCampaign($request->user(), $id, $validated);

        if (!$campaign) {
            return response()->json([
                'message' => 'Campaign not found or cannot be updated'
            ], 404);
        }

        return response()->json([
            'message' => 'Campaign updated successfully',
            'campaign' => $campaign
        ]);
    }

    /**
     * Delete a campaign.
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $deleted = $this->campaignService->deleteCampaign($request->user(), $id);

        if (!$deleted) {
            return response()->json([
                'message' => 'Campaign not found or cannot be deleted'
            ], 404);
        }

        return response()->json([
            'message' => 'Campaign deleted successfully'
        ]);
    }

    /**
     * Add prospects to a campaign.
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function addProspects(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'prospect_ids' => 'required|array',
            'prospect_ids.*' => 'required|integer|exists:prospects,id',
        ]);

        $campaign = $this->campaignService->getCampaign($request->user(), $id);

        if (!$campaign) {
            return response()->json([
                'message' => 'Campaign not found'
            ], 404);
        }

        $added = $this->campaignService->addProspects($campaign, $validated['prospect_ids']);

        return response()->json([
            'message' => "{$added} prospect(s) added to campaign",
            'added' => $added
        ]);
    }

    /**
     * Remove prospects from a campaign.
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function removeProspects(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'prospect_ids' => 'required|array',
            'prospect_ids.*' => 'required|integer|exists:prospects,id',
        ]);

        $campaign = $this->campaignService->getCampaign($request->user(), $id);

        if (!$campaign) {
            return response()->json([
                'message' => 'Campaign not found'
            ], 404);
        }

        $removed = $this->campaignService->removeProspects($campaign, $validated['prospect_ids']);

        return response()->json([
            'message' => "{$removed} prospect(s) removed from campaign",
            'removed' => $removed
        ]);
    }

    /**
     * Start/activate a campaign.
     * Generates action queue entries for all prospects.
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function start(Request $request, int $id): JsonResponse
    {
        $campaign = $this->campaignService->getCampaign($request->user(), $id);

        if (!$campaign) {
            return response()->json([
                'message' => 'Campaign not found'
            ], 404);
        }

        $result = $this->campaignService->startCampaign($campaign);

        if (!$result['success']) {
            return response()->json([
                'message' => $result['message'],
                'actions_created' => $result['actions_created'],
            ], 400);
        }

        return response()->json([
            'message' => $result['message'],
            'actions_created' => $result['actions_created'],
            'campaign' => $campaign->fresh()
        ]);
    }

    /**
     * Pause a campaign.
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function pause(Request $request, int $id): JsonResponse
    {
        $campaign = $this->campaignService->getCampaign($request->user(), $id);

        if (!$campaign) {
            return response()->json([
                'message' => 'Campaign not found'
            ], 404);
        }

        $paused = $this->campaignService->pauseCampaign($campaign);

        if (!$paused) {
            return response()->json([
                'message' => 'Campaign cannot be paused'
            ], 400);
        }

        return response()->json([
            'message' => 'Campaign paused successfully',
            'campaign' => $campaign->fresh()
        ]);
    }

    /**
     * Get campaign statistics.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function stats(Request $request): JsonResponse
    {
        $stats = $this->campaignService->getStats($request->user());

        return response()->json([
            'stats' => $stats
        ]);
    }
}
