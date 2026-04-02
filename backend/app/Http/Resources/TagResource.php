<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * TagResource
 *
 * Transforms Tag model data for API responses.
 *
 * The prospects_count field is conditionally included -- it only appears when
 * the Tag was loaded with withCount('prospects') (done by TagService::getTags).
 * This avoids an extra query when tags are loaded as nested resources inside
 * ProspectResource where the count isn't needed.
 */
class TagResource extends JsonResource
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
            'name' => $this->name,
            'color' => $this->color,
            'prospects_count' => $this->when(isset($this->prospects_count), $this->prospects_count),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
