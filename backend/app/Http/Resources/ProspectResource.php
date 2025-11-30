<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * ProspectResource
 *
 * Transforms Prospect model data for API responses.
 * Includes related tags.
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
