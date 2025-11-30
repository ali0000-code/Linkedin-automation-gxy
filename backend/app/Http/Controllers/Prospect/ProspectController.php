<?php

namespace App\Http\Controllers\Prospect;

use App\Http\Controllers\Controller;
use App\Http\Requests\Prospect\AttachTagsRequest;
use App\Http\Requests\Prospect\BulkImportProspectsRequest;
use App\Http\Requests\Prospect\StoreProspectRequest;
use App\Http\Requests\Prospect\UpdateProspectRequest;
use App\Http\Resources\ProspectResource;
use App\Services\ProspectService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * ProspectController
 *
 * Handles all prospect CRUD operations.
 * Uses ProspectService for business logic.
 */
class ProspectController extends Controller
{
    protected ProspectService $prospectService;

    public function __construct(ProspectService $prospectService)
    {
        $this->prospectService = $prospectService;
    }

    /**
     * Get all prospects with filtering and search.
     *
     * Query parameters:
     * - connection_status: Filter by status
     * - tag_id: Filter by tag
     * - search: Search in name, company, headline
     * - per_page: Items per page (default: 15)
     *
     * @param Request $request
     * @return AnonymousResourceCollection
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->only(['connection_status', 'tag_id', 'search']);
        $perPage = $request->input('per_page', 15);

        $prospects = $this->prospectService->getProspects(
            $request->user(),
            $filters,
            $perPage
        );

        return ProspectResource::collection($prospects);
    }

    /**
     * Create a new prospect.
     *
     * @param StoreProspectRequest $request
     * @return JsonResponse
     */
    public function store(StoreProspectRequest $request): JsonResponse
    {
        $prospect = $this->prospectService->createProspect(
            $request->user(),
            $request->validated()
        );

        return response()->json([
            'message' => 'Prospect created successfully',
            'prospect' => new ProspectResource($prospect->load('tags')),
        ], 201);
    }

    /**
     * Bulk import prospects (used by Chrome extension).
     *
     * @param BulkImportProspectsRequest $request
     * @return JsonResponse
     */
    public function bulkImport(BulkImportProspectsRequest $request): JsonResponse
    {
        $result = $this->prospectService->bulkImport(
            $request->user(),
            $request->validated()['prospects']
        );

        return response()->json([
            'message' => 'Bulk import completed',
            'created' => $result['created'],
            'skipped' => $result['skipped'],
            'prospects' => ProspectResource::collection($result['prospects']),
        ], 201);
    }

    /**
     * Get a single prospect by ID.
     *
     * @param int $id
     * @param Request $request
     * @return JsonResponse
     */
    public function show(int $id, Request $request): JsonResponse
    {
        $prospect = $this->prospectService->getProspect($id, $request->user());

        if (!$prospect) {
            return response()->json([
                'message' => 'Prospect not found'
            ], 404);
        }

        return response()->json([
            'prospect' => new ProspectResource($prospect)
        ]);
    }

    /**
     * Update a prospect.
     *
     * @param int $id
     * @param UpdateProspectRequest $request
     * @return JsonResponse
     */
    public function update(int $id, UpdateProspectRequest $request): JsonResponse
    {
        $prospect = $this->prospectService->getProspect($id, $request->user());

        if (!$prospect) {
            return response()->json([
                'message' => 'Prospect not found'
            ], 404);
        }

        $updatedProspect = $this->prospectService->updateProspect(
            $prospect,
            $request->validated()
        );

        return response()->json([
            'message' => 'Prospect updated successfully',
            'prospect' => new ProspectResource($updatedProspect->load('tags')),
        ]);
    }

    /**
     * Delete a prospect.
     *
     * @param int $id
     * @param Request $request
     * @return JsonResponse
     */
    public function destroy(int $id, Request $request): JsonResponse
    {
        $prospect = $this->prospectService->getProspect($id, $request->user());

        if (!$prospect) {
            return response()->json([
                'message' => 'Prospect not found'
            ], 404);
        }

        $this->prospectService->deleteProspect($prospect);

        return response()->json([
            'message' => 'Prospect deleted successfully'
        ]);
    }

    /**
     * Attach tags to a prospect.
     *
     * @param int $id
     * @param AttachTagsRequest $request
     * @return JsonResponse
     */
    public function attachTags(int $id, AttachTagsRequest $request): JsonResponse
    {
        $prospect = $this->prospectService->getProspect($id, $request->user());

        if (!$prospect) {
            return response()->json([
                'message' => 'Prospect not found'
            ], 404);
        }

        $updatedProspect = $this->prospectService->attachTags(
            $prospect,
            $request->validated()['tag_ids']
        );

        return response()->json([
            'message' => 'Tags attached successfully',
            'prospect' => new ProspectResource($updatedProspect),
        ]);
    }

    /**
     * Detach a tag from a prospect.
     *
     * @param int $prospectId
     * @param int $tagId
     * @param Request $request
     * @return JsonResponse
     */
    public function detachTag(int $prospectId, int $tagId, Request $request): JsonResponse
    {
        $prospect = $this->prospectService->getProspect($prospectId, $request->user());

        if (!$prospect) {
            return response()->json([
                'message' => 'Prospect not found'
            ], 404);
        }

        $updatedProspect = $this->prospectService->detachTag($prospect, $tagId);

        return response()->json([
            'message' => 'Tag removed successfully',
            'prospect' => new ProspectResource($updatedProspect),
        ]);
    }

    /**
     * Get prospect statistics.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function stats(Request $request): JsonResponse
    {
        $stats = $this->prospectService->getStats($request->user());

        return response()->json([
            'stats' => $stats
        ]);
    }
}
