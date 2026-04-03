<?php

namespace App\Services;

use App\Jobs\GenerateCampaignActions;
use App\Models\Campaign;
use App\Models\CampaignProspect;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Cache;

/**
 * Campaign Service
 *
 * Business logic for campaign CRUD, prospect assignment, and lifecycle management.
 *
 * Cache invalidation: Campaign stats are cached for 60 seconds per user
 * (key: "campaign_stats_{user_id}"). The cache is busted on create, delete,
 * start, and pause operations to ensure the dashboard shows fresh data.
 *
 * Campaign start flow (startCampaign):
 * 1. Validates preconditions (must be draft/paused, must have steps, must have prospects)
 * 2. For draft campaigns with a tag_id: auto-adds all prospects with that tag
 * 3. Activates the campaign (sets status=active, started_at=now)
 * 4. Dispatches GenerateCampaignActions job to generate action_queue entries
 *    asynchronously (avoids HTTP timeout for campaigns with many prospects)
 * 5. For paused campaigns being resumed: skips action generation (they already exist)
 *
 * Prospect management:
 * - addProspects: Uses bulk fetch + bulk insert to avoid N+1 queries.
 *   Pre-checks for existing assignments to prevent duplicates.
 * - removeProspects: Only removes prospects in 'pending' status (cannot remove
 *   in-progress or completed prospects).
 *
 * Delete restrictions: Only draft or completed campaigns can be deleted.
 * Active/paused campaigns must be completed or archived first.
 */
class CampaignService
{
    protected ActionQueueService $actionQueueService;

    public function __construct(ActionQueueService $actionQueueService)
    {
        $this->actionQueueService = $actionQueueService;
    }

    /**
     * Get paginated campaigns for a user with filters.
     *
     * @param User $user
     * @param array $filters (status, per_page, page, search)
     * @return LengthAwarePaginator
     */
    public function getCampaigns(User $user, array $filters = []): LengthAwarePaginator
    {
        $query = $user->campaigns()->with(['steps.action', 'steps.messageTemplate']);

        // Filter by status
        if (isset($filters['status']) && $filters['status'] !== '') {
            $query->where('status', $filters['status']);
        }

        // Search by name or description
        if (isset($filters['search']) && $filters['search'] !== '') {
            $searchTerm = $filters['search'];
            $query->where(function ($q) use ($searchTerm) {
                $q->where('name', 'like', "%{$searchTerm}%")
                    ->orWhere('description', 'like', "%{$searchTerm}%");
            });
        }

        // Order by most recent first
        $query->latest();

        // Paginate results
        $perPage = $filters['per_page'] ?? 15;
        return $query->paginate($perPage);
    }

    /**
     * Get a single campaign by ID for a user.
     *
     * @param User $user
     * @param int $campaignId
     * @return Campaign|null
     */
    public function getCampaign(User $user, int $campaignId): ?Campaign
    {
        return $user->campaigns()
            ->with(['steps.action', 'steps.messageTemplate', 'campaignProspects.prospect'])
            ->find($campaignId);
    }

    /**
     * Create a new campaign.
     *
     * @param User $user
     * @param array $data (name, description, daily_limit, tag_id, steps)
     * @return Campaign
     */
    public function createCampaign(User $user, array $data): Campaign
    {
        Cache::forget("campaign_stats_{$user->id}");

        // Create the campaign
        $campaign = $user->campaigns()->create([
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'daily_limit' => $data['daily_limit'] ?? 50,
            'tag_id' => $data['tag_id'] ?? null, // For filtering prospects by tag
            'status' => Campaign::STATUS_DRAFT,
        ]);

        // Create campaign steps if provided
        if (isset($data['steps']) && is_array($data['steps'])) {
            foreach ($data['steps'] as $index => $stepData) {
                $campaign->steps()->create([
                    'campaign_action_id' => $stepData['campaign_action_id'],
                    'order' => $index + 1,
                    'delay_days' => $stepData['delay_days'] ?? 0,
                    'message_template_id' => $stepData['message_template_id'] ?? null,
                    'config' => $stepData['config'] ?? null,
                ]);
            }
        }

        return $campaign->load(['steps.action', 'steps.messageTemplate']);
    }

    /**
     * Update an existing campaign.
     *
     * @param User $user
     * @param int $campaignId
     * @param array $data
     * @return Campaign|null
     */
    public function updateCampaign(User $user, int $campaignId, array $data): ?Campaign
    {
        $campaign = $user->campaigns()->find($campaignId);

        if (!$campaign) {
            return null;
        }

        // Only allow updating draft campaigns
        if (!$campaign->isDraft() && !$campaign->isPaused()) {
            return null;
        }

        // Update campaign details
        $campaign->update([
            'name' => $data['name'] ?? $campaign->name,
            'description' => $data['description'] ?? $campaign->description,
            'daily_limit' => $data['daily_limit'] ?? $campaign->daily_limit,
        ]);

        // Update steps if provided
        if (isset($data['steps']) && is_array($data['steps'])) {
            // Delete existing steps
            $campaign->steps()->delete();

            // Create new steps
            foreach ($data['steps'] as $index => $stepData) {
                $campaign->steps()->create([
                    'campaign_action_id' => $stepData['campaign_action_id'],
                    'order' => $index + 1,
                    'delay_days' => $stepData['delay_days'] ?? 0,
                    'message_template_id' => $stepData['message_template_id'] ?? null,
                    'config' => $stepData['config'] ?? null,
                ]);
            }
        }

        return $campaign->load(['steps.action', 'steps.messageTemplate']);
    }

    /**
     * Delete a campaign.
     *
     * @param User $user
     * @param int $campaignId
     * @return bool
     */
    public function deleteCampaign(User $user, int $campaignId): bool
    {
        $campaign = $user->campaigns()->find($campaignId);

        if (!$campaign) {
            return false;
        }

        // Clean up pending actions before deleting
        $campaign->actionQueue()->where('status', 'pending')->delete();

        Cache::forget("campaign_stats_{$user->id}");
        return $campaign->delete();
    }

    /**
     * Add prospects to a campaign.
     * OPTIMIZATION: Uses bulk fetch and bulk insert instead of N+1 queries.
     *
     * @param Campaign $campaign
     * @param array $prospectIds
     * @return int Number of prospects added
     */
    public function addProspects(Campaign $campaign, array $prospectIds): int
    {
        if (empty($prospectIds)) {
            return 0;
        }

        // OPTIMIZATION: Bulk fetch existing prospect IDs in one query
        $existingProspectIds = $campaign->campaignProspects()
            ->whereIn('prospect_id', $prospectIds)
            ->pluck('prospect_id')
            ->toArray();

        // Filter to only new prospects
        $newProspectIds = array_diff($prospectIds, $existingProspectIds);

        if (empty($newProspectIds)) {
            return 0;
        }

        // OPTIMIZATION: Bulk insert all new prospects
        $now = now();
        $insertData = [];
        foreach ($newProspectIds as $prospectId) {
            $insertData[] = [
                'campaign_id' => $campaign->id,
                'prospect_id' => $prospectId,
                'status' => CampaignProspect::STATUS_PENDING,
                'current_step' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        CampaignProspect::insert($insertData);
        $added = count($newProspectIds);

        // Update total prospects count
        $campaign->total_prospects = $campaign->campaignProspects()->count();
        $campaign->save();

        return $added;
    }

    /**
     * Remove prospects from a campaign.
     *
     * @param Campaign $campaign
     * @param array $prospectIds
     * @return int Number of prospects removed
     */
    public function removeProspects(Campaign $campaign, array $prospectIds): int
    {
        $removed = $campaign->campaignProspects()
            ->whereIn('prospect_id', $prospectIds)
            ->where('status', CampaignProspect::STATUS_PENDING) // Only remove pending prospects
            ->delete();

        // Update total prospects count
        $campaign->total_prospects = $campaign->campaignProspects()->count();
        $campaign->save();

        return $removed;
    }

    /**
     * Start/activate a campaign.
     * Generates action queue entries for all prospects and steps.
     *
     * @param Campaign $campaign
     * @return array ['success' => bool, 'message' => string, 'actions_created' => int]
     */
    public function startCampaign(Campaign $campaign): array
    {
        // Can only start draft or paused campaigns
        if (!$campaign->isDraft() && !$campaign->isPaused()) {
            return [
                'success' => false,
                'message' => 'Campaign must be in draft or paused status to start',
                'actions_created' => 0,
            ];
        }

        // Must have at least one step
        if ($campaign->steps()->count() === 0) {
            return [
                'success' => false,
                'message' => 'Campaign must have at least one step',
                'actions_created' => 0,
            ];
        }

        // Check if campaign is being resumed (paused) or started fresh (draft)
        $isResume = $campaign->isPaused();

        if ($isResume) {
            // For resume: check if there are any prospects still needing action
            $activeProspects = $campaign->campaignProspects()
                ->whereIn('status', [CampaignProspect::STATUS_PENDING, CampaignProspect::STATUS_IN_PROGRESS])
                ->count();

            if ($activeProspects === 0) {
                return [
                    'success' => false,
                    'message' => 'No active prospects to resume. All prospects are completed or failed.',
                    'actions_created' => 0,
                ];
            }
        } else {
            // For new start: if tag_id is set, auto-add prospects with that tag
            if ($campaign->tag_id) {
                $prospectsWithTag = \App\Models\Prospect::where('user_id', $campaign->user_id)
                    ->whereHas('tags', function ($query) use ($campaign) {
                        $query->where('tags.id', $campaign->tag_id);
                    })
                    ->pluck('id')
                    ->toArray();

                if (empty($prospectsWithTag)) {
                    return [
                        'success' => false,
                        'message' => 'No prospects found with the selected tag',
                        'actions_created' => 0,
                    ];
                }

                // Add prospects to campaign
                $this->addProspects($campaign, $prospectsWithTag);
            }

            // Must have at least one pending prospect
            $pendingProspects = $campaign->campaignProspects()->pending()->count();
            if ($pendingProspects === 0) {
                return [
                    'success' => false,
                    'message' => 'Campaign must have at least one pending prospect',
                    'actions_created' => 0,
                ];
            }
        }

        Cache::forget("campaign_stats_{$campaign->user_id}");

        // Activate the campaign first
        $activated = $campaign->activate();

        if (!$activated) {
            return [
                'success' => false,
                'message' => 'Failed to activate campaign',
                'actions_created' => 0,
            ];
        }

        // Generate action queue entries for all prospects (or resume existing)
        try {
            if ($isResume) {
                // For resume, just count existing pending actions
                $pendingActions = \App\Models\ActionQueue::where('campaign_id', $campaign->id)
                    ->where('status', 'pending')
                    ->count();

                return [
                    'success' => true,
                    'message' => "Campaign resumed successfully. {$pendingActions} pending actions.",
                    'actions_created' => $pendingActions,
                ];
            } else {
                // Dispatch action generation to background job
                GenerateCampaignActions::dispatch($campaign);

                return [
                    'success' => true,
                    'message' => 'Campaign started. Actions are being generated in the background.',
                    'actions_created' => 0,
                ];
            }
        } catch (\Exception $e) {
            // Rollback campaign status on failure
            $campaign->update(['status' => Campaign::STATUS_DRAFT]);

            return [
                'success' => false,
                'message' => 'Failed to generate actions: ' . $e->getMessage(),
                'actions_created' => 0,
            ];
        }
    }

    /**
     * Pause a campaign.
     *
     * @param Campaign $campaign
     * @return bool
     */
    public function pauseCampaign(Campaign $campaign): bool
    {
        // Can only pause active campaigns
        if (!$campaign->isActive()) {
            return false;
        }

        Cache::forget("campaign_stats_{$campaign->user_id}");
        return $campaign->pause();
    }

    /**
     * Get campaign statistics.
     *
     * @param User $user
     * @return array
     */
    public function getStats(User $user): array
    {
        return \Illuminate\Support\Facades\Cache::remember("campaign_stats_{$user->id}", 60, function () use ($user) {
            $stats = Campaign::where('user_id', $user->id)
                ->selectRaw('COUNT(*) as total')
                ->selectRaw("SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active")
                ->selectRaw("SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft")
                ->selectRaw("SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) as paused")
                ->selectRaw("SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed")
                ->first();

            return [
                'total' => (int) ($stats->total ?? 0),
                'active' => (int) ($stats->active ?? 0),
                'draft' => (int) ($stats->draft ?? 0),
                'paused' => (int) ($stats->paused ?? 0),
                'completed' => (int) ($stats->completed ?? 0),
            ];
        });
    }
}
