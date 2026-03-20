<?php

namespace App\Jobs;

use App\Models\Campaign;
use App\Services\ActionQueueService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * GenerateCampaignActions Job
 *
 * Asynchronous job that generates action_queue entries when a campaign is started.
 *
 * This is dispatched from CampaignService::startCampaign() to avoid HTTP request
 * timeouts -- a campaign with 1000 prospects and 3 steps would create 3000 action
 * queue rows, which can take several seconds.
 *
 * The campaign is already in 'active' status when this job runs. If action
 * generation fails, the campaign is rolled back to 'draft' status so the user
 * can fix the issue and try again.
 *
 * Configuration:
 * - tries = 1: No automatic retries (action generation is idempotent but we
 *   don't want partial duplicates from retries; the user can manually restart)
 * - timeout = 300: 5-minute timeout for large campaigns
 *
 * The Campaign model is serialized via SerializesModels, meaning only the
 * campaign ID is stored in the queue payload and the full model is re-fetched
 * when the job executes.
 */
class GenerateCampaignActions implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /** @var int Do not retry -- partial duplicate actions would be confusing */
    public int $tries = 1;

    /** @var int 5-minute timeout for large campaigns with many prospects */
    public int $timeout = 300;

    public function __construct(
        public Campaign $campaign
    ) {}

    /**
     * Execute the job: generate action queue entries for the campaign.
     *
     * Delegates to ActionQueueService which handles bulk insert, personalization,
     * and scheduling. On failure, rolls back campaign to draft status.
     *
     * @param ActionQueueService $actionQueueService Injected by Laravel's container
     * @return void
     */
    public function handle(ActionQueueService $actionQueueService): void
    {
        try {
            $actionsCreated = $actionQueueService->generateActionsForCampaign($this->campaign);

            Log::info("Job: Generated {$actionsCreated} actions for campaign {$this->campaign->id}");
        } catch (\Exception $e) {
            Log::error("Job: Failed to generate actions for campaign {$this->campaign->id}: " . $e->getMessage());

            // Rollback campaign status so user can fix and retry
            $this->campaign->update(['status' => Campaign::STATUS_DRAFT]);

            throw $e;
        }
    }
}
