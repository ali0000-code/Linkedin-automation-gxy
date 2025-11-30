<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * UserResource
 *
 * Transforms User model data for API responses.
 * Controls which user attributes are exposed to the API.
 * Hides sensitive data like passwords.
 */
class UserResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * Defines what user data is returned in API responses.
     * Only include data that clients need to see.
     *
     * @param Request $request
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'email_verified_at' => $this->email_verified_at,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
