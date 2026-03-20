<?php

namespace App\Services;

use App\Models\User;
use App\Models\LinkedInAccount;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Laravel\Socialite\Contracts\User as SocialiteUser;

/**
 * LinkedInOAuthService
 *
 * Business logic for LinkedIn OAuth authentication.
 * Handles user creation, LinkedIn account linking, and token management.
 */
class LinkedInOAuthService
{
    /**
     * Handle OAuth callback and create/update user
     *
     * Creates new user account if first time, otherwise updates existing
     * Also creates/updates LinkedIn account record
     *
     * @param SocialiteUser $linkedInUser - Socialite user from LinkedIn
     * @return array - Contains user and linkedInAccount models
     */
    public function handleOAuthCallback(SocialiteUser $linkedInUser): array
    {
        return DB::transaction(function () use ($linkedInUser) {
            // Extract data from LinkedIn OAuth response
            $linkedInId = $linkedInUser->getId();
            $email = $linkedInUser->getEmail();
            $name = $linkedInUser->getName();
            $profileUrl = $linkedInUser->user['profile_url'] ?? null;
            $profileImageUrl = $linkedInUser->getAvatar();

            // Additional fields from LinkedIn (if available)
            $headline = $linkedInUser->user['headline'] ?? null;
            $location = $linkedInUser->user['location'] ?? null;

            // OAuth tokens
            $accessToken = $linkedInUser->token;
            $refreshToken = $linkedInUser->refreshToken;
            $expiresIn = $linkedInUser->expiresIn; // Seconds until expiration

            // Calculate token expiration timestamp
            $tokenExpiresAt = now()->addSeconds($expiresIn);

            // Find or create user by linkedin_id
            $user = User::where('linkedin_id', $linkedInId)->first();

            if ($user) {
                // User exists - update their info
                $user->update([
                    'name' => $name,
                    'email' => $email,
                    'profile_url' => $profileUrl,
                    'profile_image_url' => $profileImageUrl,
                    'oauth_access_token' => Crypt::encryptString($accessToken),
                    'oauth_refresh_token' => $refreshToken ? Crypt::encryptString($refreshToken) : null,
                    'token_expires_at' => $tokenExpiresAt,
                    'last_login_at' => now(),
                ]);
            } else {
                // New user - create account
                $user = User::create([
                    'linkedin_id' => $linkedInId,
                    'name' => $name,
                    'email' => $email,
                    'profile_url' => $profileUrl,
                    'profile_image_url' => $profileImageUrl,
                    'oauth_access_token' => Crypt::encryptString($accessToken),
                    'oauth_refresh_token' => $refreshToken ? Crypt::encryptString($refreshToken) : null,
                    'token_expires_at' => $tokenExpiresAt,
                    'last_login_at' => now(),
                ]);
            }

            // Create or update LinkedIn account
            $linkedInAccount = LinkedInAccount::updateOrCreate(
                ['user_id' => $user->id],
                [
                    'linkedin_id' => $linkedInId,
                    'full_name' => $name,
                    'profile_url' => $profileUrl,
                    'email' => $email,
                    'profile_image_url' => $profileImageUrl,
                    'headline' => $headline,
                    'location' => $location,
                    'is_active' => true,
                    'last_synced_at' => now(),
                ]
            );

            return [
                'user' => $user->fresh(), // Reload to get updated timestamps
                'linkedInAccount' => $linkedInAccount,
            ];
        });
    }

    /**
     * Refresh OAuth access token
     *
     * Uses refresh token to get new access token before expiration
     * Updates user record with new tokens
     *
     * @param User $user
     * @return bool - Success status
     */
    public function refreshAccessToken(User $user): bool
    {
        // Check if refresh token exists
        if (!$user->oauth_refresh_token) {
            \Log::warning('No refresh token available for user', ['user_id' => $user->id]);
            return false;
        }

        try {
            // Decrypt refresh token
            $refreshToken = Crypt::decryptString($user->oauth_refresh_token);

            // Exchange refresh token for new access token
            // Note: LinkedIn OAuth refresh endpoint
            $response = Http::asForm()->post('https://www.linkedin.com/oauth/v2/accessToken', [
                'grant_type' => 'refresh_token',
                'refresh_token' => $refreshToken,
                'client_id' => config('services.linkedin.client_id'),
                'client_secret' => config('services.linkedin.client_secret'),
            ]);

            if ($response->successful()) {
                $data = $response->json();

                // Update user with new tokens
                $user->update([
                    'oauth_access_token' => Crypt::encryptString($data['access_token']),
                    'oauth_refresh_token' => isset($data['refresh_token'])
                        ? Crypt::encryptString($data['refresh_token'])
                        : $user->oauth_refresh_token,
                    'token_expires_at' => now()->addSeconds($data['expires_in']),
                ]);

                return true;
            }

            return false;

        } catch (\Exception $e) {
            \Log::error('Failed to refresh OAuth token', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Check if user's OAuth token is expired or expiring soon
     *
     * @param User $user
     * @param int $bufferMinutes - Minutes before expiration to consider "expiring soon"
     * @return bool
     */
    public function isTokenExpiring(User $user, int $bufferMinutes = 60): bool
    {
        if (!$user->token_expires_at) {
            return true;
        }

        return $user->token_expires_at->lessThan(now()->addMinutes($bufferMinutes));
    }

    /**
     * Get decrypted OAuth access token for API calls
     *
     * Automatically refreshes if expired/expiring
     *
     * @param User $user
     * @return string|null
     */
    public function getValidAccessToken(User $user): ?string
    {
        // Check if token is expired or expiring soon
        if ($this->isTokenExpiring($user)) {
            $this->refreshAccessToken($user);
            $user->refresh(); // Reload user model
        }

        try {
            return Crypt::decryptString($user->oauth_access_token);
        } catch (\Exception $e) {
            \Log::error('Failed to decrypt OAuth token', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }
}
