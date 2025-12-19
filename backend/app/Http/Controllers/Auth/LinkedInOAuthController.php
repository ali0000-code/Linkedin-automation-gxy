<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\LinkedInOAuthService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Laravel\Socialite\Facades\Socialite;

/**
 * LinkedInOAuthController
 *
 * Handles LinkedIn OAuth 2.0 authentication flow.
 * Provides redirect to LinkedIn and callback handling.
 */
class LinkedInOAuthController extends Controller
{
    protected LinkedInOAuthService $oauthService;

    public function __construct(LinkedInOAuthService $oauthService)
    {
        $this->oauthService = $oauthService;
    }

    /**
     * Redirect to LinkedIn OAuth consent screen
     *
     * Step 1 of OAuth flow: Redirect user to LinkedIn to authorize
     *
     * @return \Illuminate\Http\RedirectResponse
     */
    public function redirect(Request $request)
    {
        // Generate state parameter for CSRF protection
        $state = $request->query('state', bin2hex(random_bytes(16)));

        // Store state in session for validation in callback
        session(['oauth_state' => $state]);

        // Redirect to LinkedIn with state parameter
        return Socialite::driver('linkedin')
            ->with(['state' => $state])
            ->redirect();
    }

    /**
     * Handle OAuth callback from LinkedIn
     *
     * Step 2 of OAuth flow: LinkedIn redirects back with authorization code
     * Exchange code for access token, create/update user, return Sanctum token
     *
     * @param Request $request
     * @return \Illuminate\Http\RedirectResponse
     */
    public function callback(Request $request)
    {
        try {
            // Log the callback request for debugging
            \Log::info('LinkedIn OAuth callback received', [
                'query_params' => $request->query(),
                'has_code' => $request->has('code'),
                'has_state' => $request->has('state'),
            ]);

            // Get LinkedIn user data via Socialite (uses stateless mode to skip state validation)
            \Log::info('Attempting to get LinkedIn user via Socialite');
            $linkedInUser = Socialite::driver('linkedin')->stateless()->user();

            \Log::info('LinkedIn user retrieved', [
                'id' => $linkedInUser->getId(),
                'email' => $linkedInUser->getEmail(),
                'name' => $linkedInUser->getName(),
            ]);

            // Create or update user and LinkedIn account
            $result = $this->oauthService->handleOAuthCallback($linkedInUser);

            // Generate Sanctum API token for the user
            $token = $result['user']->createToken('oauth-token', ['*'], now()->addDays(30))->plainTextToken;

            \Log::info('OAuth callback successful, redirecting with token');

            // Redirect to frontend with token as URL fragment (secure, not logged)
            $frontendUrl = config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:3000'));
            return redirect("{$frontendUrl}/auth/callback#token={$token}");

        } catch (\Exception $e) {
            // Log detailed error for debugging
            \Log::error('LinkedIn OAuth callback failed', [
                'error' => $e->getMessage(),
                'error_class' => get_class($e),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
                'request_params' => $request->all(),
            ]);

            // Redirect to frontend with error
            $frontendUrl = config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:3000'));
            $errorMessage = $e->getMessage() ?: 'Unknown OAuth error';
            $errorMessage = urlencode($errorMessage);
            return redirect("{$frontendUrl}/auth/callback?error={$errorMessage}");
        }
    }

    /**
     * Validate OAuth state parameter
     *
     * Prevents CSRF attacks by ensuring state matches what we sent
     *
     * @param Request $request
     * @throws \Exception
     */
    protected function validateState(Request $request)
    {
        $requestState = $request->query('state');
        $sessionState = session('oauth_state');

        if (!$requestState || !$sessionState || $requestState !== $sessionState) {
            throw new \Exception('Invalid OAuth state parameter. Possible CSRF attack.');
        }

        // Clear state from session after validation
        session()->forget('oauth_state');
    }

    /**
     * Verify LinkedIn account linkage (for extension)
     *
     * Extension calls this to verify user's LinkedIn account is linked
     * Validates linkedin_id matches authenticated user's account
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function verifyLinkedInAccount(Request $request): JsonResponse
    {
        $request->validate([
            'linkedin_id' => 'required|string',
        ]);

        $user = $request->user();
        $linkedInAccount = $user->linkedInAccount;

        // Check if user has a linked LinkedIn account
        if (!$linkedInAccount) {
            return response()->json([
                'linked' => false,
                'message' => 'No LinkedIn account linked to this user.',
            ], 404);
        }

        // Verify the linkedin_id matches
        if ($linkedInAccount->linkedin_id !== $request->linkedin_id) {
            return response()->json([
                'linked' => false,
                'message' => 'LinkedIn account ID does not match.',
            ], 403);
        }

        return response()->json([
            'linked' => true,
            'account' => [
                'linkedin_id' => $linkedInAccount->linkedin_id,
                'full_name' => $linkedInAccount->full_name,
                'email' => $linkedInAccount->email,
                'profile_url' => $linkedInAccount->profile_url,
            ],
        ]);
    }

    /**
     * Get LinkedIn OAuth authorization URL (for frontend)
     *
     * Returns the OAuth URL without redirecting (useful for frontend SPAs)
     *
     * @return JsonResponse
     */
    public function getAuthUrl(): JsonResponse
    {
        $state = bin2hex(random_bytes(16));
        session(['oauth_state' => $state]);

        $url = Socialite::driver('linkedin')
            ->with(['state' => $state])
            ->redirect()
            ->getTargetUrl();

        return response()->json(['url' => $url]);
    }
}
