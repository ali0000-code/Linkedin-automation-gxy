<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Models\ActionQueue;
use App\Models\Campaign;
use App\Models\Prospect;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Dashboard Controller
 *
 * Provides aggregated statistics for the dashboard homepage.
 */
class DashboardController extends Controller
{
    /**
     * Get all dashboard statistics.
     *
     * GET /api/dashboard
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $today = Carbon::today();

        // Get prospect stats
        $prospectStats = Prospect::where('user_id', $user->id)
            ->selectRaw('COUNT(*) as total')
            ->selectRaw("SUM(CASE WHEN connection_status = 'connected' THEN 1 ELSE 0 END) as connected")
            ->selectRaw("SUM(CASE WHEN connection_status = 'pending' THEN 1 ELSE 0 END) as pending")
            ->selectRaw('SUM(CASE WHEN email IS NOT NULL AND email != \'\' THEN 1 ELSE 0 END) as with_email')
            ->first();

        // Get campaign stats by status
        $campaignStats = Campaign::where('user_id', $user->id)
            ->selectRaw('COUNT(*) as total')
            ->selectRaw("SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active")
            ->selectRaw("SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) as paused")
            ->selectRaw("SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft")
            ->selectRaw("SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed")
            ->first();

        // Get today's activity - actions completed today by type
        $todayActivity = ActionQueue::where('user_id', $user->id)
            ->where('status', 'completed')
            ->whereDate('executed_at', $today)
            ->selectRaw("SUM(CASE WHEN action_type = 'visit' THEN 1 ELSE 0 END) as visits")
            ->selectRaw("SUM(CASE WHEN action_type = 'invite' THEN 1 ELSE 0 END) as invites")
            ->selectRaw("SUM(CASE WHEN action_type = 'message' THEN 1 ELSE 0 END) as messages")
            ->selectRaw("SUM(CASE WHEN action_type = 'follow' THEN 1 ELSE 0 END) as follows")
            ->selectRaw("SUM(CASE WHEN action_type = 'email' THEN 1 ELSE 0 END) as emails")
            ->selectRaw('COUNT(*) as total')
            ->first();

        // Get today's pending actions count
        $todayPending = ActionQueue::where('user_id', $user->id)
            ->where('status', 'pending')
            ->whereDate('scheduled_for', $today)
            ->count();

        // Get user's daily limit (use first active campaign's limit or default)
        $dailyLimit = Campaign::where('user_id', $user->id)
            ->where('status', 'active')
            ->value('daily_limit') ?? 50;

        // Get active campaigns with progress
        $activeCampaigns = Campaign::where('user_id', $user->id)
            ->where('status', 'active')
            ->withCount([
                'prospects as total_prospects',
                'prospects as completed_prospects' => function ($query) {
                    $query->where('campaign_prospects.status', 'completed');
                },
                'prospects as in_progress_prospects' => function ($query) {
                    $query->where('campaign_prospects.status', 'in_progress');
                },
            ])
            ->with(['steps.action:id,key,name'])
            ->get()
            ->map(function ($campaign) use ($today) {
                // Get today's action count for this campaign
                $todayActions = ActionQueue::where('campaign_id', $campaign->id)
                    ->where('status', 'completed')
                    ->whereDate('executed_at', $today)
                    ->count();

                return [
                    'id' => $campaign->id,
                    'name' => $campaign->name,
                    'status' => $campaign->status,
                    'daily_limit' => $campaign->daily_limit,
                    'total_prospects' => $campaign->total_prospects,
                    'completed_prospects' => $campaign->completed_prospects,
                    'in_progress_prospects' => $campaign->in_progress_prospects,
                    'progress_percent' => $campaign->total_prospects > 0
                        ? round(($campaign->completed_prospects / $campaign->total_prospects) * 100)
                        : 0,
                    'today_actions' => $todayActions,
                    'action_type' => $campaign->steps->first()?->action?->name ?? 'Unknown',
                ];
            });

        // Get next scheduled action
        $nextAction = ActionQueue::where('user_id', $user->id)
            ->where('status', 'pending')
            ->where('scheduled_for', '>', now())
            ->orderBy('scheduled_for', 'asc')
            ->first();

        return response()->json([
            'prospects' => [
                'total' => (int) ($prospectStats->total ?? 0),
                'connected' => (int) ($prospectStats->connected ?? 0),
                'pending' => (int) ($prospectStats->pending ?? 0),
                'with_email' => (int) ($prospectStats->with_email ?? 0),
            ],
            'campaigns' => [
                'total' => (int) ($campaignStats->total ?? 0),
                'active' => (int) ($campaignStats->active ?? 0),
                'paused' => (int) ($campaignStats->paused ?? 0),
                'draft' => (int) ($campaignStats->draft ?? 0),
                'completed' => (int) ($campaignStats->completed ?? 0),
            ],
            'today' => [
                'completed' => (int) ($todayActivity->total ?? 0),
                'pending' => $todayPending,
                'daily_limit' => $dailyLimit,
                'visits' => (int) ($todayActivity->visits ?? 0),
                'invites' => (int) ($todayActivity->invites ?? 0),
                'messages' => (int) ($todayActivity->messages ?? 0),
                'follows' => (int) ($todayActivity->follows ?? 0),
                'emails' => (int) ($todayActivity->emails ?? 0),
            ],
            'active_campaigns' => $activeCampaigns,
            'next_action' => $nextAction ? [
                'scheduled_for' => $nextAction->scheduled_for->toIso8601String(),
                'action_type' => $nextAction->action_type,
            ] : null,
        ]);
    }
}
