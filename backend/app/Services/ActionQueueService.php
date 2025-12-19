<?php

namespace App\Services;

use App\Models\ActionQueue;
use App\Models\Campaign;
use App\Models\CampaignAction;
use App\Models\CampaignProspect;
use App\Models\CampaignStep;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Action Queue Service
 *
 * Handles action queue generation and management for campaign execution.
 * When a campaign is started, this service generates all the actions
 * that need to be executed by the Chrome extension.
 */
class ActionQueueService
{
    /**
     * Action type constants matching CampaignAction keys
     */
    const ACTION_VISIT = 'visit';
    const ACTION_INVITE = 'invite';
    const ACTION_MESSAGE = 'message';
    const ACTION_FOLLOW = 'follow';
    const ACTION_EMAIL = 'email';

    /**
     * Status constants
     */
    const STATUS_PENDING = 'pending';
    const STATUS_IN_PROGRESS = 'in_progress';
    const STATUS_COMPLETED = 'completed';
    const STATUS_FAILED = 'failed';

    /**
     * Generate action queue entries when a campaign starts.
     * Creates actions for all pending prospects based on campaign steps.
     *
     * @param Campaign $campaign
     * @return int Number of actions generated
     */
    public function generateActionsForCampaign(Campaign $campaign): int
    {
        $actionsCreated = 0;

        // Get all campaign steps ordered by sequence
        $steps = $campaign->steps()->ordered()->with(['action', 'messageTemplate'])->get();

        if ($steps->isEmpty()) {
            Log::warning("Campaign {$campaign->id} has no steps, cannot generate actions");
            return 0;
        }

        // Get all pending prospects in this campaign
        $campaignProspects = $campaign->campaignProspects()
            ->pending()
            ->with('prospect')
            ->get();

        if ($campaignProspects->isEmpty()) {
            Log::warning("Campaign {$campaign->id} has no pending prospects");
            return 0;
        }

        DB::beginTransaction();

        try {
            foreach ($campaignProspects as $campaignProspect) {
                // Calculate scheduled time based on step delays
                $scheduledFor = now();

                foreach ($steps as $step) {
                    // Add delay from previous steps
                    if ($step->delay_days > 0) {
                        $scheduledFor = $scheduledFor->copy()->addDays($step->delay_days);
                    }

                    // Prepare action data (message content, etc.)
                    $actionData = $this->prepareActionData($step, $campaignProspect);

                    // Create the action queue entry
                    ActionQueue::create([
                        'user_id' => $campaign->user_id,
                        'campaign_id' => $campaign->id,
                        'campaign_prospect_id' => $campaignProspect->id,
                        'campaign_step_id' => $step->id,
                        'prospect_id' => $campaignProspect->prospect_id,
                        'action_type' => $step->action->key,
                        'action_data' => $actionData, // Model casts to JSON automatically
                        'scheduled_for' => $scheduledFor,
                        'status' => self::STATUS_PENDING,
                        'retry_count' => 0,
                    ]);

                    $actionsCreated++;
                }

                // Mark campaign prospect as in progress
                $campaignProspect->markInProgress();
            }

            DB::commit();

            Log::info("Generated {$actionsCreated} actions for campaign {$campaign->id}");

            return $actionsCreated;

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Failed to generate actions for campaign {$campaign->id}: " . $e->getMessage());
            throw $e;
        }
    }

    /**
     * Prepare action data based on step configuration.
     * Handles message template personalization.
     *
     * @param CampaignStep $step
     * @param CampaignProspect $campaignProspect
     * @return array
     */
    protected function prepareActionData(CampaignStep $step, CampaignProspect $campaignProspect): array
    {
        $data = [
            'step_order' => $step->order,
            'action_key' => $step->action->key,
        ];

        // Include message template content if step requires it
        if ($step->needsTemplate() && $step->messageTemplate) {
            $prospect = $campaignProspect->prospect;

            // Get raw template content
            $message = $step->messageTemplate->content;

            // Personalize the message with prospect data
            $message = $this->personalizeMessage($message, $prospect);

            $data['message'] = $message;
            $data['template_id'] = $step->message_template_id;
            $data['template_type'] = $step->messageTemplate->type;
        }

        // Include any step-specific config
        if ($step->config) {
            $data['config'] = $step->config;
        }

        return $data;
    }

    /**
     * Personalize a message template with prospect data.
     * Replaces placeholders like {firstName}, {lastName}, {company}, etc.
     *
     * @param string $message
     * @param \App\Models\Prospect $prospect
     * @return string
     */
    protected function personalizeMessage(string $message, $prospect): string
    {
        // Parse full name into first and last name
        $nameParts = explode(' ', trim($prospect->full_name ?? ''));
        $firstName = $nameParts[0] ?? '';
        $lastName = count($nameParts) > 1 ? implode(' ', array_slice($nameParts, 1)) : '';

        // Replace placeholders
        $replacements = [
            '{firstName}' => $firstName,
            '{firstName}' => $firstName, // Handle different cases
            '{lastName}' => $lastName,
            '{fullName}' => $prospect->full_name ?? '',
            '{company}' => $prospect->company ?? '',
            '{headline}' => $prospect->headline ?? '',
            '{location}' => $prospect->location ?? '',
        ];

        return str_replace(array_keys($replacements), array_values($replacements), $message);
    }

    /**
     * Get the next pending action ready to execute for a user.
     * Returns the oldest pending action that is scheduled for now or earlier.
     * Only returns actions from active campaigns.
     * Also checks for stale in_progress actions (older than 5 minutes) and resets them.
     *
     * @param User $user
     * @return ActionQueue|null
     */
    public function getNextAction(User $user): ?ActionQueue
    {
        // First, reset any stale in_progress actions (stuck for more than 5 minutes)
        ActionQueue::where('user_id', $user->id)
            ->where('status', self::STATUS_IN_PROGRESS)
            ->where('updated_at', '<', now()->subMinutes(5))
            ->update([
                'status' => self::STATUS_PENDING,
                'result' => 'Reset: Action was stuck in progress'
            ]);

        return ActionQueue::where('user_id', $user->id)
            ->where('status', self::STATUS_PENDING)
            ->where('scheduled_for', '<=', now())
            ->whereHas('campaign', function ($query) {
                $query->where('status', Campaign::STATUS_ACTIVE);
            })
            ->orderBy('scheduled_for', 'asc')
            ->with(['prospect', 'campaign', 'campaignStep.action', 'campaignStep.messageTemplate'])
            ->first();
    }

    /**
     * Mark an action as in progress (being executed by extension).
     *
     * @param ActionQueue $action
     * @return bool
     */
    public function markInProgress(ActionQueue $action): bool
    {
        $action->status = self::STATUS_IN_PROGRESS;
        return $action->save();
    }

    /**
     * Mark an action as completed successfully.
     *
     * @param ActionQueue $action
     * @param string|null $result Optional result message
     * @return bool
     */
    public function markCompleted(ActionQueue $action, ?string $result = null): bool
    {
        DB::beginTransaction();

        try {
            // Update action queue
            $action->status = self::STATUS_COMPLETED;
            $action->executed_at = now();
            $action->result = $result;
            $action->save();

            // Update campaign prospect
            $campaignProspect = $action->campaignProspect;
            if ($campaignProspect) {
                $campaignProspect->advanceStep();

                // Check if all steps are completed
                $campaign = $action->campaign;
                $totalSteps = $campaign->steps()->count();

                if ($campaignProspect->current_step >= $totalSteps) {
                    $campaignProspect->markCompleted();
                    $campaign->incrementProcessedProspects();
                    $campaign->incrementSuccessCount();
                }
            }

            // Update campaign stats
            $this->checkCampaignCompletion($action->campaign);

            DB::commit();
            return true;

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Failed to mark action {$action->id} as completed: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Mark an action as failed.
     *
     * @param ActionQueue $action
     * @param string $error Error message
     * @param bool $retry Should we retry this action?
     * @return bool
     */
    public function markFailed(ActionQueue $action, string $error, bool $retry = false): bool
    {
        DB::beginTransaction();

        try {
            if ($retry && $action->retry_count < 3) {
                // Retry: increment count and reschedule for 5 minutes later
                $action->retry_count++;
                $action->scheduled_for = now()->addMinutes(5);
                $action->status = self::STATUS_PENDING;
                $action->result = "Retry {$action->retry_count}: {$error}";
            } else {
                // Final failure
                $action->status = self::STATUS_FAILED;
                $action->executed_at = now();
                $action->result = $error;

                // Mark campaign prospect as failed
                $campaignProspect = $action->campaignProspect;
                if ($campaignProspect) {
                    $campaignProspect->markFailed($error);

                    // Update campaign stats
                    $campaign = $action->campaign;
                    $campaign->incrementProcessedProspects();
                    $campaign->incrementFailureCount();
                }

                // Cancel remaining actions for this prospect in this campaign
                $this->cancelRemainingActions($action);
            }

            $action->save();

            // Check if campaign is done
            $this->checkCampaignCompletion($action->campaign);

            DB::commit();
            return true;

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Failed to mark action {$action->id} as failed: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Cancel all remaining pending actions for a prospect in a campaign.
     * Used when a prospect fails or is removed from campaign.
     *
     * @param ActionQueue $action
     * @return int Number of actions cancelled
     */
    protected function cancelRemainingActions(ActionQueue $action): int
    {
        return ActionQueue::where('campaign_id', $action->campaign_id)
            ->where('campaign_prospect_id', $action->campaign_prospect_id)
            ->where('status', self::STATUS_PENDING)
            ->where('id', '!=', $action->id)
            ->update([
                'status' => self::STATUS_FAILED,
                'result' => 'Cancelled: Previous action failed',
                'executed_at' => now(),
            ]);
    }

    /**
     * Check if a campaign has completed all actions and update status.
     *
     * @param Campaign $campaign
     * @return void
     */
    protected function checkCampaignCompletion(Campaign $campaign): void
    {
        // Refresh campaign data
        $campaign->refresh();

        // Count pending actions
        $pendingActions = ActionQueue::where('campaign_id', $campaign->id)
            ->whereIn('status', [self::STATUS_PENDING, self::STATUS_IN_PROGRESS])
            ->count();

        // If no pending actions and campaign is active, mark as completed
        if ($pendingActions === 0 && $campaign->isActive()) {
            $campaign->complete();
            Log::info("Campaign {$campaign->id} completed automatically");
        }
    }

    /**
     * Pause all pending actions for a campaign.
     *
     * @param Campaign $campaign
     * @return int Number of actions paused
     */
    public function pauseCampaignActions(Campaign $campaign): int
    {
        // We don't change action status, just pause the campaign
        // Extension will check campaign status before executing
        return ActionQueue::where('campaign_id', $campaign->id)
            ->where('status', self::STATUS_PENDING)
            ->count();
    }

    /**
     * Get action queue statistics for a user.
     *
     * @param User $user
     * @return array
     */
    public function getStats(User $user): array
    {
        $baseQuery = ActionQueue::where('user_id', $user->id);

        return [
            'pending' => (clone $baseQuery)->where('status', self::STATUS_PENDING)->count(),
            'in_progress' => (clone $baseQuery)->where('status', self::STATUS_IN_PROGRESS)->count(),
            'completed' => (clone $baseQuery)->where('status', self::STATUS_COMPLETED)->count(),
            'failed' => (clone $baseQuery)->where('status', self::STATUS_FAILED)->count(),
            'today_completed' => (clone $baseQuery)
                ->where('status', self::STATUS_COMPLETED)
                ->whereDate('executed_at', today())
                ->count(),
            'today_failed' => (clone $baseQuery)
                ->where('status', self::STATUS_FAILED)
                ->whereDate('executed_at', today())
                ->count(),
        ];
    }

    /**
     * Get today's action count for daily limit enforcement.
     *
     * @param User $user
     * @return int
     */
    public function getTodayActionCount(User $user): int
    {
        return ActionQueue::where('user_id', $user->id)
            ->where('status', self::STATUS_COMPLETED)
            ->whereDate('executed_at', today())
            ->count();
    }

    /**
     * Check if user has reached daily limit.
     *
     * @param User $user
     * @param int $dailyLimit Default 50
     * @return bool
     */
    public function hasReachedDailyLimit(User $user, int $dailyLimit = 50): bool
    {
        return $this->getTodayActionCount($user) >= $dailyLimit;
    }
}
