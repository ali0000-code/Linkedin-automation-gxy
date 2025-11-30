<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * LogoutController
 *
 * Handles user logout.
 * Revokes the current access token.
 */
class LogoutController extends Controller
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
     * Log out the authenticated user.
     *
     * Revokes the current access token.
     * The client should discard the token after this.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function __invoke(Request $request): JsonResponse
    {
        // Logout via service layer (revokes current token)
        $this->authService->logout($request->user());

        return response()->json([
            'message' => 'Logout successful',
        ]);
    }
}
