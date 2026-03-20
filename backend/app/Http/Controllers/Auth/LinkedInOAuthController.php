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
 * Handles all authentication flows for the platform:
 *
 * 1. LinkedIn OAuth 2.0 (web app login):
 *    - redirect()  -> sends user to LinkedIn consent screen
 *    - callback()  -> LinkedIn redirects back with auth code; we exchange it for
 *      tokens, create/update the User + LinkedInAccount, issue a Sanctum token,
 *      and redirect to the frontend with the token as a URL fragment
 *    - getAuthUrl() -> returns the OAuth URL as JSON (for SPA frontend)
 *
 * 2. Extension authentication (Chrome extension login):
 *    - extensionAuth()  -> public endpoint; accepts auth_key, returns Sanctum token
 *    - The auth_key is a 22-char random string the user copies from web app settings
 *    - This avoids the extension needing to handle the full OAuth redirect flow
 *
 * 3. Auth key management:
 *    - getAuthKey()        -> returns the user's current auth key
 *    - regenerateAuthKey() -> generates a new key (invalidates old extension sessions)
 *
 * 4. Account verification:
 *    - verifyLinkedInAccount() -> extension calls this to confirm the LinkedIn account
 *      the user is logged into matches the one linked in our system
 *
 * Device limit: All token creation goes through createTokenWithDeviceLimit() which
 * enforces max 3 concurrent Sanctum tokens per user.
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
            // Get LinkedIn user data via Socialite
            $linkedInUser = Socialite::driver('linkedin')->stateless()->user();

            \Log::info('LinkedIn OAuth callback successful', [
                'linkedin_id' => $linkedInUser->getId(),
            ]);

            // Create or update user and LinkedIn account
            $result = $this->oauthService->handleOAuthCallback($linkedInUser);

            // Ensure user has an auth key for extension authentication
            $result['user']->ensureAuthKey();

            // Generate Sanctum API token with 3-device limit
            $token = $result['user']->createTokenWithDeviceLimit('webapp')->plainTextToken;

            // Redirect to frontend with token as URL fragment
            // URL-encode the token to handle special characters like |
            $frontendUrl = config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:3000'));
            $encodedToken = urlencode($token);
            return redirect("{$frontendUrl}/auth/callback#token={$encodedToken}");

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

    /**
     * Authenticate extension via auth key.
     * Public endpoint — validates user by auth_key, returns Sanctum token.
     *
     * POST /api/auth/extension
     */
    public function extensionAuth(Request $request): JsonResponse
    {
        $request->validate([
            'auth_key' => 'required|string|size:22',
        ]);

        $user = \App\Models\User::where('auth_key', $request->auth_key)->first();

        if (!$user) {
            return response()->json([
                'message' => 'Invalid auth key.',
            ], 401);
        }

        if (!$user->is_active) {
            return response()->json([
                'message' => 'Account is inactive.',
            ], 403);
        }

        // Create token with 3-device limit
        $token = $user->createTokenWithDeviceLimit('extension')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'profile_image_url' => $user->profile_image_url,
            ],
        ]);
    }

    /**
     * Get the current user's auth key.
     *
     * GET /api/auth/key
     */
    public function getAuthKey(Request $request): JsonResponse
    {
        $user = $request->user();
        $authKey = $user->ensureAuthKey();

        return response()->json([
            'auth_key' => $authKey,
        ]);
    }

    /**
     * Regenerate the user's auth key.
     * This invalidates any extension using the old key.
     *
     * POST /api/auth/key/regenerate
     */
    public function regenerateAuthKey(Request $request): JsonResponse
    {
        $user = $request->user();
        $newKey = $user->regenerateAuthKey();

        return response()->json([
            'auth_key' => $newKey,
            'message' => 'Auth key regenerated. Update your extension with the new key.',
        ]);
    }
}
