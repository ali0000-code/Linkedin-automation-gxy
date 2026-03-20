<?php

namespace App\Http\Controllers\Tag;

use App\Http\Controllers\Controller;
use App\Http\Requests\Tag\StoreTagRequest;
use App\Http\Requests\Tag\UpdateTagRequest;
use App\Http\Resources\TagResource;
use App\Services\TagService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * TagController
 *
 * Handles all tag CRUD operations.
 * Uses TagService for business logic.
 */
class TagController extends Controller
{
    protected TagService $tagService;

    public function __construct(TagService $tagService)
    {
        $this->tagService = $tagService;
    }

    /**
     * Get all tags for the authenticated user.
     *
     * @param Request $request
     * @return AnonymousResourceCollection
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $tags = $this->tagService->getTags($request->user());
        return TagResource::collection($tags);
    }

    /**
     * Create a new tag.
     *
     * @param StoreTagRequest $request
     * @return JsonResponse
     */
    public function store(StoreTagRequest $request): JsonResponse
    {
        $tag = $this->tagService->createTag(
            $request->user(),
            $request->validated()
        );

        return response()->json([
            'message' => 'Tag created successfully',
            'tag' => new TagResource($tag),
        ], 201);
    }

    /**
     * Get a single tag by ID.
     *
     * @param int $id
     * @param Request $request
     * @return JsonResponse
     */
    public function show(int $id, Request $request): JsonResponse
    {
        $tag = $this->tagService->getTag($id, $request->user());

        if (!$tag) {
            return response()->json([
                'message' => 'Tag not found'
            ], 404);
        }

        return response()->json([
            'tag' => new TagResource($tag)
        ]);
    }

    /**
     * Update a tag.
     *
     * @param int $id
     * @param UpdateTagRequest $request
     * @return JsonResponse
     */
    public function update(int $id, UpdateTagRequest $request): JsonResponse
    {
        $tag = $this->tagService->getTag($id, $request->user());

        if (!$tag) {
            return response()->json([
                'message' => 'Tag not found'
            ], 404);
        }

        $updatedTag = $this->tagService->updateTag($tag, $request->validated());

        return response()->json([
            'message' => 'Tag updated successfully',
            'tag' => new TagResource($updatedTag),
        ]);
    }

    /**
     * Delete a tag.
     *
     * @param int $id
     * @param Request $request
     * @return JsonResponse
     */
    public function destroy(int $id, Request $request): JsonResponse
    {
        $tag = $this->tagService->getTag($id, $request->user());

        if (!$tag) {
            return response()->json([
                'message' => 'Tag not found'
            ], 404);
        }

        $this->tagService->deleteTag($tag);

        return response()->json([
            'message' => 'Tag deleted successfully'
        ]);
    }
}
