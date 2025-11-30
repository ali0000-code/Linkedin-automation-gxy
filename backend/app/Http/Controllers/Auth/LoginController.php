<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;

/**
 * LoginController
 *
 * Handles user login.
 * Validates credentials and returns a Sanctum access token.
 */
class LoginController extends Controller
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
     * Log in a user.
     *
     * Validates credentials, generates an API token, and returns both.
     * The token should be stored by the client for authenticating future requests.
     *
     * @param LoginRequest $request Validated login request
     * @return JsonResponse
     */
    public function __invoke(LoginRequest $request): JsonResponse
    {
        // Attempt login via service layer
        // Will throw ValidationException if credentials are invalid
        $result = $this->authService->login($request->validated());

        // Return user data and token
        return response()->json([
            'message' => 'Login successful',
            'user' => new UserResource($result['user']),
            'token' => $result['token'],
        ]);
    }
}
