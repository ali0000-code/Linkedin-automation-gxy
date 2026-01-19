<?php

namespace App\Http\Requests\Prospect;

use Illuminate\Foundation\Http\FormRequest;

/**
 * BulkImportProspectsRequest
 *
 * Form request for validating bulk prospect import data.
 * Used by the Chrome extension to import multiple prospects at once.
 */
class BulkImportProspectsRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true; // Authorization handled by auth middleware
    }

    /**
     * Get the validation rules for bulk import.
     */
    public function rules(): array
    {
        return [
            'prospects' => ['required', 'array', 'min:1', 'max:100'], // Max 100 at once
            'prospects.*.full_name' => ['required', 'string', 'max:255'],
            'prospects.*.profile_url' => ['required', 'string', 'url', 'max:500'],
            'prospects.*.linkedin_id' => ['nullable', 'string', 'max:255'],
            'prospects.*.headline' => ['nullable', 'string', 'max:500'],
            'prospects.*.location' => ['nullable', 'string', 'max:255'],
            'prospects.*.company' => ['nullable', 'string', 'max:255'],
            'prospects.*.profile_image_url' => ['nullable', 'string', 'url', 'max:500'],
            'prospects.*.email' => ['nullable', 'email', 'max:255'],
        ];
    }

    /**
     * Get custom validation messages.
     */
    public function messages(): array
    {
        return [
            'prospects.required' => 'Please provide an array of prospects.',
            'prospects.min' => 'Please provide at least one prospect.',
            'prospects.max' => 'You can only import up to 100 prospects at once.',
            'prospects.*.full_name.required' => 'Each prospect must have a name.',
            'prospects.*.profile_url.required' => 'Each prospect must have a profile URL.',
            'prospects.*.profile_url.url' => 'Please provide valid URLs.',
        ];
    }
}
