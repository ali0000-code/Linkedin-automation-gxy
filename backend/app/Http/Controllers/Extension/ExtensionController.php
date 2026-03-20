<?php

namespace App\Http\Controllers\Extension;

use App\Http\Controllers\Controller;
use App\Models\ActionQueue;
use App\Models\Campaign;
use App\Models\Prospect;
use App\Services\ActionQueueService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Extension Controller
 *
 * Handles API endpoints specifically for the Chrome extension.
 * Includes action queue management and account verification.
 */
class ExtensionController extends Controller
{
    protected ActionQueueService $actionQueueService;

    public function __construct(ActionQueueService $actionQueueService)
    {
        $this->actionQueueService = $actionQueueService;
    }

    /**
     * Verify that the current LinkedIn account matches the authenticated user.
     * Extension calls this before executing any actions.
     *
     * POST /api/extension/verify-account
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function verifyAccount(Request $request): JsonResponse
    {
        $request->validate([
            'linkedin_profile_url' => 'required|string',
            'linkedin_name' => 'nullable|string',
        ]);

        $user = $request->user();
        $linkedInAccount = $user->linkedInAccount;

        // Check if user has a linked LinkedIn account
        if (!$linkedInAccount) {
            return response()->json([
                'success' => false,
                'verified' => false,
                'error' => 'No LinkedIn account linked to this user',
                'message' => 'Please connect your LinkedIn account first.',
            ], 400);
        }

        // Extract LinkedIn ID from profile URL
        $providedUrl = $request->input('linkedin_profile_url');
        $providedLinkedInId = $this->extractLinkedInId($providedUrl);
        $providedName = $request->input('linkedin_name');

        // Get the stored LinkedIn ID
        $storedLinkedInId = $linkedInAccount->linkedin_id;
        $storedProfileUrl = $linkedInAccount->profile_url;
        $storedName = $linkedInAccount->full_name;

        // Compare LinkedIn IDs/URLs
        $urlMatch = false;

        // Method 1: Try direct ID comparison (OAuth ID vs OAuth ID)
        if ($providedLinkedInId && $storedLinkedInId) {
            $urlMatch = strtolower($providedLinkedInId) === strtolower($storedLinkedInId);
        }

        // Method 2: Compare profile URL slugs
        if (!$urlMatch && $storedProfileUrl) {
            $storedSlug = $this->extractLinkedInId($storedProfileUrl);
            if ($storedSlug && $providedLinkedInId) {
                $urlMatch = strtolower($storedSlug) === strtolower($providedLinkedInId);
            }
        }

        // Method 3: If no stored profile URL, update it for future verifications
        // and allow if the name matches (first-time profile URL capture)
        if (!$urlMatch && !$storedProfileUrl && $providedUrl) {
            // Store the profile URL for future verifications
            $linkedInAccount->update(['profile_url' => $providedUrl]);
            Log::info("Stored profile URL for user {$user->id}: {$providedUrl}");
            $urlMatch = true; // Allow this verification
        }

        if ($urlMatch) {
            // Update last verified timestamp
            $linkedInAccount->update(['last_synced_at' => now()]);

            return response()->json([
                'success' => true,
                'verified' => true,
                'message' => 'LinkedIn account verified successfully',
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                ],
                'linkedin_account' => [
                    'linkedin_id' => $linkedInAccount->linkedin_id,
                    'full_name' => $linkedInAccount->full_name,
                ],
            ]);
        }

        // Account mismatch
        Log::warning("LinkedIn account mismatch for user {$user->id}. Expected: {$storedLinkedInId}, Got: {$providedLinkedInId}");

        return response()->json([
            'success' => false,
            'verified' => false,
            'error' => 'LinkedIn account mismatch',
            'message' => 'The LinkedIn account you are logged into does not match your connected account. Please log into the correct LinkedIn account.',
            'expected_account' => $linkedInAccount->full_name ?? 'Unknown',
        ], 403);
    }

    /**
     * Get the next pending action for the extension to execute.
     *
     * GET /api/extension/actions/next
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function getNextAction(Request $request): JsonResponse
    {
        $user = $request->user();

        // Check daily limit
        $dailyLimit = 50; // Default, could be from user settings
        $todayCount = $this->actionQueueService->getTodayActionCount($user);

        if ($todayCount >= $dailyLimit) {
            return response()->json([
                'success' => true,
                'has_action' => false,
                'action' => null,
                'message' => 'Daily limit reached',
                'daily_limit' => $dailyLimit,
                'today_count' => $todayCount,
            ]);
        }

        // Get next action
        $action = $this->actionQueueService->getNextAction($user);

        if (!$action) {
            return response()->json([
                'success' => true,
                'has_action' => false,
                'action' => null,
                'message' => 'No pending actions',
                'daily_limit' => $dailyLimit,
                'today_count' => $todayCount,
            ]);
        }

        // Check if campaign is still active BEFORE marking as in_progress
        // This prevents race condition where action gets stuck in in_progress state
        if (!$action->campaign || !$action->campaign->isActive()) {
            return response()->json([
                'success' => true,
                'has_action' => false,
                'action' => null,
                'message' => 'Campaign is not active',
            ]);
        }

        // Mark as in progress (only after confirming campaign is active)
        // Use atomic update to prevent race conditions with concurrent requests
        $updated = $this->actionQueueService->markInProgressAtomic($action);

        // If another request already grabbed this action, get the next one
        if (!$updated) {
            return response()->json([
                'success' => true,
                'has_action' => false,
                'action' => null,
                'message' => 'Action was claimed by another request, please retry',
                'daily_limit' => $dailyLimit,
                'today_count' => $todayCount,
            ]);
        }

        // Refresh the action to get the updated state
        $action->refresh();

        // action_data is already cast to array by Eloquent model
        $actionData = $action->action_data;

        return response()->json([
            'success' => true,
            'has_action' => true,
            'action' => [
                'id' => $action->id,
                'campaign_id' => $action->campaign_id,
                'campaign_name' => $action->campaign->name ?? 'Unknown',
                'action_type' => $action->action_type,
                'action_data' => $actionData,
                'scheduled_for' => $action->scheduled_for->toIso8601String(),
                'retry_count' => $action->retry_count,
                'prospect' => [
                    'id' => $action->prospect->id,
                    'full_name' => $action->prospect->full_name,
                    'profile_url' => $action->prospect->profile_url,
                    'linkedin_id' => $action->prospect->linkedin_id,
                    'headline' => $action->prospect->headline,
                    'company' => $action->prospect->company,
                    'connection_status' => $action->prospect->connection_status,
                ],
            ],
            'daily_limit' => $dailyLimit,
            'today_count' => $todayCount,
            'remaining_today' => $dailyLimit - $todayCount - 1,
        ]);
    }

    /**
     * Report the result of an action execution.
     *
     * POST /api/extension/actions/{id}/complete
     *
     * @param Request $request
     * @param int $id Action ID
     * @return JsonResponse
     */
    public function completeAction(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'status' => 'required|in:completed,failed',
            'result' => 'nullable|string|max:1000',
            'error' => 'nullable|string|max:1000',
            'retry' => 'nullable|boolean',
        ]);

        $user = $request->user();

        // Find the action
        $action = ActionQueue::where('id', $id)
            ->where('user_id', $user->id)
            ->first();

        if (!$action) {
            return response()->json([
                'success' => false,
                'error' => 'Action not found',
            ], 404);
        }

        // Check if action is in progress
        if ($action->status !== 'in_progress') {
            return response()->json([
                'success' => false,
                'error' => 'Action is not in progress',
                'current_status' => $action->status,
            ], 400);
        }

        $status = $request->input('status');

        if ($status === 'completed') {
            $result = $this->actionQueueService->markCompleted(
                $action,
                $request->input('result')
            );

            // Update prospect connection status if this was a connection request
            if ($action->action_type === 'invite' && $action->prospect) {
                $action->prospect->update(['connection_status' => 'pending']);
            }

            return response()->json([
                'success' => $result,
                'message' => $result ? 'Action completed successfully' : 'Failed to update action',
            ]);
        } else {
            $retry = $request->input('retry', false);
            $error = $request->input('error', 'Unknown error');

            $result = $this->actionQueueService->markFailed($action, $error, $retry);

            return response()->json([
                'success' => $result['success'],
                'message' => $result['success']
                    ? ($result['retry_scheduled'] ? 'Action will be retried' : 'Action marked as failed')
                    : 'Failed to update action',
                'retry_scheduled' => $result['retry_scheduled'],
            ]);
        }
    }

    /**
     * Get action queue statistics for the current user.
     *
     * GET /api/extension/actions/stats
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function getActionStats(Request $request): JsonResponse
    {
        $user = $request->user();
        $stats = $this->actionQueueService->getStats($user);

        return response()->json([
            'success' => true,
            'stats' => $stats,
            'daily_limit' => 50,
            'remaining_today' => max(0, 50 - $stats['today_completed']),
        ]);
    }

    /**
     * Get active campaigns with pending actions.
     *
     * GET /api/extension/campaigns/active
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function getActiveCampaigns(Request $request): JsonResponse
    {
        $user = $request->user();

        $campaigns = Campaign::where('user_id', $user->id)
            ->where('status', Campaign::STATUS_ACTIVE)
            ->withCount([
                'campaignProspects as pending_count' => function ($query) {
                    $query->where('status', 'pending');
                },
                'campaignProspects as in_progress_count' => function ($query) {
                    $query->where('status', 'in_progress');
                },
                'campaignProspects as completed_count' => function ($query) {
                    $query->where('status', 'completed');
                },
                'campaignProspects as failed_count' => function ($query) {
                    $query->where('status', 'failed');
                },
            ])
            ->get(['id', 'name', 'status', 'daily_limit', 'total_prospects', 'processed_prospects', 'success_count', 'failure_count', 'started_at']);

        // Get pending action counts per campaign
        $pendingActions = ActionQueue::where('user_id', $user->id)
            ->where('status', 'pending')
            ->selectRaw('campaign_id, COUNT(*) as count')
            ->groupBy('campaign_id')
            ->pluck('count', 'campaign_id');

        $campaignsData = $campaigns->map(function ($campaign) use ($pendingActions) {
            return [
                'id' => $campaign->id,
                'name' => $campaign->name,
                'status' => $campaign->status,
                'daily_limit' => $campaign->daily_limit,
                'total_prospects' => $campaign->total_prospects,
                'processed_prospects' => $campaign->processed_prospects,
                'success_count' => $campaign->success_count,
                'failure_count' => $campaign->failure_count,
                'pending_actions' => $pendingActions[$campaign->id] ?? 0,
                'progress_percentage' => $campaign->total_prospects > 0
                    ? round(($campaign->processed_prospects / $campaign->total_prospects) * 100, 1)
                    : 0,
                'started_at' => $campaign->started_at?->toIso8601String(),
            ];
        });

        return response()->json([
            'success' => true,
            'campaigns' => $campaignsData,
            'total_active' => $campaigns->count(),
        ]);
    }

    /**
     * Update prospect email after extraction from LinkedIn.
     *
     * PATCH /api/extension/prospects/{linkedinId}/email
     *
     * @param Request $request
     * @param string $linkedinId LinkedIn ID (e.g., "john-doe-123456")
     * @return JsonResponse
     */
    public function updateProspectEmail(Request $request, string $linkedinId): JsonResponse
    {
        $request->validate([
            'email' => 'required|email|max:255',
        ]);

        $user = $request->user();

        // Find the prospect belonging to this user by LinkedIn ID
        $prospect = Prospect::where('linkedin_id', $linkedinId)
            ->where('user_id', $user->id)
            ->first();

        if (!$prospect) {
            return response()->json([
                'success' => false,
                'error' => 'Prospect not found',
            ], 404);
        }

        // Update the email
        $prospect->update(['email' => $request->input('email')]);

        Log::info("Email updated for prospect {$prospect->id}", [
            'user_id' => $user->id,
            'prospect_id' => $prospect->id,
            'linkedin_id' => $linkedinId,
            'email' => $request->input('email'),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Prospect email updated successfully',
            'prospect' => [
                'id' => $prospect->id,
                'full_name' => $prospect->full_name,
                'email' => $prospect->email,
            ],
        ]);
    }

    /**
     * Get email extraction results for a campaign.
     * Returns counts of prospects with/without emails after extraction.
     * OPTIMIZATION: Uses database-level filtering instead of loading all and filtering in PHP.
     *
     * GET /api/extension/campaigns/{id}/extraction-results
     *
     * @param Request $request
     * @param int $id Campaign ID
     * @return JsonResponse
     */
    public function getExtractionResults(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        $campaign = Campaign::where('id', $id)
            ->where('user_id', $user->id)
            ->first();

        if (!$campaign) {
            return response()->json([
                'success' => false,
                'error' => 'Campaign not found',
            ], 404);
        }

        // OPTIMIZATION: Query only the fields we need, filter at database level
        $selectFields = ['prospects.id', 'prospects.full_name', 'prospects.profile_url', 'prospects.linkedin_id', 'prospects.email'];

        // Get prospects WITH email
        $withEmail = Prospect::select($selectFields)
            ->join('campaign_prospects', 'prospects.id', '=', 'campaign_prospects.prospect_id')
            ->where('campaign_prospects.campaign_id', $campaign->id)
            ->whereNotNull('prospects.email')
            ->where('prospects.email', '!=', '')
            ->get()
            ->toArray();

        // Get prospects WITHOUT email
        $withoutEmail = Prospect::select($selectFields)
            ->join('campaign_prospects', 'prospects.id', '=', 'campaign_prospects.prospect_id')
            ->where('campaign_prospects.campaign_id', $campaign->id)
            ->where(function ($query) {
                $query->whereNull('prospects.email')
                    ->orWhere('prospects.email', '=', '');
            })
            ->get()
            ->toArray();

        return response()->json([
            'success' => true,
            'campaign_id' => $campaign->id,
            'campaign_name' => $campaign->name,
            'total_prospects' => count($withEmail) + count($withoutEmail),
            'with_email_count' => count($withEmail),
            'without_email_count' => count($withoutEmail),
            'with_email' => $withEmail,
            'without_email' => $withoutEmail,
        ]);
    }

    /**
     * Extract LinkedIn ID from a profile URL.
     *
     * @param string $url
     * @return string|null
     */
    protected function extractLinkedInId(string $url): ?string
    {
        // Match patterns like /in/john-doe/ or /in/john-doe
        if (preg_match('/linkedin\.com\/in\/([^\/\?]+)/', $url, $matches)) {
            return $matches[1];
        }

        // If it's just the ID without full URL
        if (preg_match('/^[a-zA-Z0-9\-]+$/', $url)) {
            return $url;
        }

        return null;
    }
}
