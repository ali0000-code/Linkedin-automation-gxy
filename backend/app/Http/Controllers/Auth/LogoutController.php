<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LogoutController extends Controller
{
    /**
     * Log out the authenticated user.
     *
     * Revokes ALL tokens (webapp + extension) so the extension
     * is also logged out when the user signs out from the web app.
     */
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();

        // Revoke all tokens for this user (webapp + extension)
        $user->tokens()->delete();

        return response()->json([
            'message' => 'Logout successful',
        ]);
    }
}
