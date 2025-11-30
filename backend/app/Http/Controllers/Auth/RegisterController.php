<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;

/**
 * RegisterController
 *
 * Handles user registration.
 * Creates a new user account and returns a Sanctum access token.
 */
class RegisterController extends Controller
{
    /**
     * The authentication service instance.
     */
    protected AuthService $authService;

    /**
     * Create a new controller instance.
     *
     * Dependency injection: Laravel automatically injects AuthService.
     */
    public function __construct(AuthService $authService)
    {
        $this->authService = $authService;
    }

    /**
     * Register a new user.
     *
     * Creates a user account, generates an API token, and returns both.
     * The token should be stored by the client for future API requests.
     *
     * @param RegisterRequest $request Validated registration request
     * @return JsonResponse
     */
    public function __invoke(RegisterRequest $request): JsonResponse
    {
        // Register the user via service layer
        $user = $this->authService->register($request->validated());

        // Generate Sanctum access token for immediate login
        $token = $user->createToken('api-token')->plainTextToken;

        // Return user data and token
        return response()->json([
            'message' => 'Registration successful',
            'user' => new UserResource($user),
            'token' => $token,
        ], 201);
    }
}
