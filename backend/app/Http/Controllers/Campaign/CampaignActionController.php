<?php

namespace App\Http\Controllers\Campaign;

use App\Http\Controllers\Controller;
use App\Models\CampaignAction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Campaign Action Controller
 *
 * Handles HTTP requests for fetching available campaign action types.
 * These are the building blocks for creating campaigns.
 */
class CampaignActionController extends Controller
{
    /**
     * Get all available campaign action types.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        $actions = CampaignAction::active()->ordered()->get();

        return response()->json([
            'actions' => $actions
        ]);
    }

    /**
     * Get a single campaign action by ID.
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $action = CampaignAction::find($id);

        if (!$action) {
            return response()->json([
                'message' => 'Campaign action not found'
            ], 404);
        }

        return response()->json([
            'action' => $action
        ]);
    }
}
