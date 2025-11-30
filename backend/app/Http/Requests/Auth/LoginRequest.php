<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

/**
 * LoginRequest
 *
 * Form request for validating user login credentials.
 * Automatically validates and returns errors if validation fails.
 */
class LoginRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     *
     * Login is public, so always return true.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules for login.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ];
    }

    /**
     * Get custom validation messages.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'email.required' => 'Please provide your email address.',
            'email.email' => 'Please provide a valid email address.',
            'password.required' => 'Please provide your password.',
        ];
    }
}
