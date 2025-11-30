<?php

namespace App\Http\Requests\Prospect;

use Illuminate\Foundation\Http\FormRequest;

/**
 * UpdateProspectRequest
 *
 * Form request for validating prospect update data.
 */
class UpdateProspectRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true; // Authorization handled by controller
    }

    /**
     * Get the validation rules for updating a prospect.
     */
    public function rules(): array
    {
        $prospectId = $this->route('prospect'); // Get prospect ID from route

        return [
            'full_name' => ['sometimes', 'string', 'max:255'],
            'profile_url' => [
                'sometimes',
                'string',
                'url',
                'max:500',
                // Ensure profile_url is unique except for this prospect
                'unique:prospects,profile_url,' . $prospectId . ',id,user_id,' . auth()->id()
            ],
            'linkedin_id' => ['nullable', 'string', 'max:255'],
            'headline' => ['nullable', 'string', 'max:500'],
            'location' => ['nullable', 'string', 'max:255'],
            'company' => ['nullable', 'string', 'max:255'],
            'profile_image_url' => ['nullable', 'string', 'url', 'max:500'],
            'connection_status' => [
                'sometimes',
                'string',
                'in:not_connected,pending,connected,withdrawn'
            ],
            'notes' => ['nullable', 'string'],
        ];
    }

    /**
     * Get custom validation messages.
     */
    public function messages(): array
    {
        return [
            'profile_url.unique' => 'This profile URL is already used by another prospect.',
            'profile_url.url' => 'Please provide a valid URL.',
            'connection_status.in' => 'Invalid connection status.',
        ];
    }
}
