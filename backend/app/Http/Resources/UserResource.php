<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * UserResource
 *
 * Transforms User model data for API responses.
 *
 * Exposed: id, name, email, profile URLs, has_auth_key flag, timestamps.
 * Hidden (not included): oauth tokens, auth_key value, linkedin_id.
 *
 * The has_auth_key boolean lets the frontend know whether to show the
 * "copy auth key" button without exposing the actual key value.
 * The actual auth_key is only returned via the dedicated /api/auth/key endpoint.
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
            'profile_url' => $this->profile_url,
            'profile_image_url' => $this->profile_image_url,
            'has_auth_key' => !empty($this->auth_key),
            'email_verified_at' => $this->email_verified_at,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
