<?php

namespace App\Http\Requests\Prospect;

use Illuminate\Foundation\Http\FormRequest;

/**
 * AttachTagsRequest
 *
 * Form request for validating tag attachment to prospects.
 */
class AttachTagsRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules.
     */
    public function rules(): array
    {
        return [
            'tag_ids' => ['required', 'array', 'min:1'],
            'tag_ids.*' => ['required', 'integer', 'exists:tags,id'],
        ];
    }

    /**
     * Get custom validation messages.
     */
    public function messages(): array
    {
        return [
            'tag_ids.required' => 'Please provide at least one tag ID.',
            'tag_ids.*.exists' => 'One or more tag IDs are invalid.',
        ];
    }
}
