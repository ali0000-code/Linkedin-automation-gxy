<?php

namespace App\Http\Requests\Tag;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * UpdateTagRequest
 *
 * Form request for validating tag update data.
 */
class UpdateTagRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules for updating a tag.
     */
    public function rules(): array
    {
        $tagId = $this->route('tag'); // Get tag ID from route

        return [
            'name' => [
                'sometimes',
                'string',
                'max:100',
                // Ensure tag name is unique except for this tag
                Rule::unique('tags')->where(function ($query) {
                    return $query->where('user_id', auth()->id());
                })->ignore($tagId)
            ],
            'color' => ['nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
        ];
    }

    /**
     * Get custom validation messages.
     */
    public function messages(): array
    {
        return [
            'name.unique' => 'You already have a tag with this name.',
            'color.regex' => 'Please provide a valid hex color code (e.g., #3b82f6).',
        ];
    }
}
