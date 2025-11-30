<?php

namespace App\Http\Requests\Prospect;

use Illuminate\Foundation\Http\FormRequest;

/**
 * StoreProspectRequest
 *
 * Form request for validating prospect creation data.
 */
class StoreProspectRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true; // Authorization handled by auth middleware
    }

    /**
     * Get the validation rules for creating a prospect.
     */
    public function rules(): array
    {
        return [
            'full_name' => ['required', 'string', 'max:255'],
            'profile_url' => [
                'required',
                'string',
                'url',
                'max:500',
                // Ensure profile_url is unique for this user
                'unique:prospects,profile_url,NULL,id,user_id,' . auth()->id()
            ],
            'linkedin_id' => ['nullable', 'string', 'max:255'],
            'headline' => ['nullable', 'string', 'max:500'],
            'location' => ['nullable', 'string', 'max:255'],
            'company' => ['nullable', 'string', 'max:255'],
            'profile_image_url' => ['nullable', 'string', 'url', 'max:500'],
            'connection_status' => [
                'nullable',
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
            'full_name.required' => 'Please provide the prospect\'s name.',
            'profile_url.required' => 'Please provide the LinkedIn profile URL.',
            'profile_url.unique' => 'You have already added this prospect.',
            'profile_url.url' => 'Please provide a valid URL.',
            'connection_status.in' => 'Invalid connection status.',
        ];
    }
}
