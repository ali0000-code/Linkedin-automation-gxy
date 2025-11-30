<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * AuthService
 *
 * Service class for handling authentication business logic.
 * Keeps controllers thin by extracting authentication logic here.
 * Follows the Service Layer Pattern for better code organization.
 */
class AuthService
{
    /**
     * Register a new user.
     *
     * Creates a new user account with the provided credentials.
     * Automatically hashes the password before storing.
     *
     * @param array $data User registration data (name, email, password)
     * @return User The newly created user
     */
    public function register(array $data): User
    {
        // Create the user (password is automatically hashed via User model cast)
        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => $data['password'], // Will be hashed automatically
        ]);

        return $user;
    }

    /**
     * Log in a user and generate an API token.
     *
     * Validates credentials and creates a Sanctum access token.
     * The token is used for authenticating API requests.
     *
     * @param array $credentials Login credentials (email, password)
     * @return array Contains the user and their access token
     * @throws ValidationException If credentials are invalid
     */
    public function login(array $credentials): array
    {
        // Find user by email
        $user = User::where('email', $credentials['email'])->first();

        // Check if user exists and password is correct
        if (!$user || !Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        // Create a new Sanctum access token
        // Token name helps identify where the token was created (web, extension, etc.)
        $token = $user->createToken('api-token')->plainTextToken;

        return [
            'user' => $user,
            'token' => $token,
        ];
    }

    /**
     * Log out a user by revoking their current access token.
     *
     * Deletes the token used for the current request.
     * The user will need to log in again to get a new token.
     *
     * @param User $user The authenticated user
     * @return void
     */
    public function logout(User $user): void
    {
        // Revoke the current user's access token
        // This deletes the token from the database
        $user->currentAccessToken()->delete();
    }

    /**
     * Log out from all devices by revoking all access tokens.
     *
     * Deletes all tokens for the user, logging them out everywhere.
     * Useful for security purposes (e.g., password reset, suspicious activity).
     *
     * @param User $user The authenticated user
     * @return void
     */
    public function logoutFromAllDevices(User $user): void
    {
        // Revoke all tokens for this user
        $user->tokens()->delete();
    }
}
