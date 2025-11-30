<?php

namespace App\Http\Requests\Tag;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * StoreTagRequest
 *
 * Form request for validating tag creation data.
 */
class StoreTagRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules for creating a tag.
     */
    public function rules(): array
    {
        return [
            'name' => [
                'required',
                'string',
                'max:100',
                // Ensure tag name is unique for this user
                Rule::unique('tags')->where(function ($query) {
                    return $query->where('user_id', auth()->id());
                })
            ],
            'color' => ['nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'], // Hex color
        ];
    }

    /**
     * Get custom validation messages.
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Please provide a tag name.',
            'name.unique' => 'You already have a tag with this name.',
            'color.regex' => 'Please provide a valid hex color code (e.g., #3b82f6).',
        ];
    }
}
