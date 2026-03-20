<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * ProspectResource
 *
 * Transforms Prospect model data for API responses.
 *
 * Includes all prospect fields the frontend needs, plus:
 * - tags: nested TagResource collection (only when the 'tags' relationship is loaded,
 *   via whenLoaded to avoid N+1 queries when tags aren't needed)
 * - connection_status: important for the UI to show connect/message buttons
 * - notes: user-added free-text notes about the prospect
 *
 * Fields like user_id are intentionally omitted since all prospects
 * belong to the authenticated user (no cross-user visibility).
 */
class ProspectResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @param Request $request
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'linkedin_id' => $this->linkedin_id,
            'full_name' => $this->full_name,
            'email' => $this->email,
            'headline' => $this->headline,
            'profile_url' => $this->profile_url,
            'location' => $this->location,
            'company' => $this->company,
            'profile_image_url' => $this->profile_image_url,
            'connection_status' => $this->connection_status,
            'notes' => $this->notes,
            'last_contacted_at' => $this->last_contacted_at,
            'tags' => TagResource::collection($this->whenLoaded('tags')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
