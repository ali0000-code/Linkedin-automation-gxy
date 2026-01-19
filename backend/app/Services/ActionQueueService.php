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

        $prospect = $campaignProspect->prospect;

        // Handle conditional actions (like connect_message) that need two templates
        if ($step->action->key === 'connect_message') {
            $config = $step->config ?? [];

            // Primary template: used when connected (message)
            if ($step->messageTemplate) {
                $data['connected_message'] = $this->personalizeMessage(
                    $step->messageTemplate->content,
                    $prospect
                );
                $data['connected_template_id'] = $step->message_template_id;
            }

            // Secondary template: used when not connected (invite)
            // Stored in step config as 'invite_template_id'
            if (!empty($config['invite_template_id'])) {
                $inviteTemplate = \App\Models\MessageTemplate::find($config['invite_template_id']);
                if ($inviteTemplate) {
                    $data['invite_message'] = $this->personalizeMessage(
                        $inviteTemplate->content,
                        $prospect
                    );
                    $data['invite_template_id'] = $config['invite_template_id'];
                }
            }

            $data['is_conditional'] = true;
        }
        // Handle visit_follow_connect (combo: visit + follow + invite)
        elseif ($step->action->key === 'visit_follow_connect') {
            // Only needs invite template
            if ($step->messageTemplate) {
                $data['invite_message'] = $this->personalizeMessage(
                    $step->messageTemplate->content,
                    $prospect
                );
                $data['template_id'] = $step->message_template_id;
            }
            $data['is_combo'] = true;
        }
        // Handle email_message (email if possible, message as fallback)
        elseif ($step->action->key === 'email_message') {
            $config = $step->config ?? [];

            // Include prospect's email (if available) for the extension to check
            $data['prospect_email'] = $prospect->email;

            // Primary template: email
            if ($step->messageTemplate) {
                $emailTemplate = $step->messageTemplate;
                $data['email_subject'] = $this->personalizeMessage(
                    $emailTemplate->subject ?? 'Hello {firstName}',
                    $prospect
                );
                $data['email_body'] = $this->personalizeMessage(
                    $emailTemplate->content,
                    $prospect
                );
                $data['email_template_id'] = $step->message_template_id;
            }

            // Fallback template: LinkedIn message (stored in config)
            if (!empty($config['fallback_template_id'])) {
                $fallbackTemplate = \App\Models\MessageTemplate::find($config['fallback_template_id']);
                if ($fallbackTemplate) {
                    $data['fallback_message'] = $this->personalizeMessage(
                        $fallbackTemplate->content,
                        $prospect
                    );
                    $data['fallback_template_id'] = $config['fallback_template_id'];
                }
            }

            $data['is_conditional'] = true;
        }
        // Standard template handling for non-conditional actions
        elseif ($step->needsTemplate() && $step->messageTemplate) {
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

        // Replace placeholders (support multiple case variations)
        $replacements = [
            '{firstName}' => $firstName,
            '{FirstName}' => $firstName,
            '{first_name}' => $firstName,
            '{lastName}' => $lastName,
            '{LastName}' => $lastName,
            '{last_name}' => $lastName,
            '{fullName}' => $prospect->full_name ?? '',
            '{FullName}' => $prospect->full_name ?? '',
            '{full_name}' => $prospect->full_name ?? '',
            '{company}' => $prospect->company ?? '',
            '{Company}' => $prospect->company ?? '',
            '{headline}' => $prospect->headline ?? '',
            '{Headline}' => $prospect->headline ?? '',
            '{location}' => $prospect->location ?? '',
            '{Location}' => $prospect->location ?? '',
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
        // OPTIMIZATION: Only check for stale actions once every 2 minutes per user
        // Instead of running UPDATE query on every poll
        $this->resetStaleActionsIfNeeded($user);

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
     * Reset stale in_progress actions, but only check once every 2 minutes per user.
     * Uses cache to avoid running expensive UPDATE query on every poll.
     *
     * @param User $user
     * @return void
     */
    protected function resetStaleActionsIfNeeded(User $user): void
    {
        $cacheKey = "stale_action_check_{$user->id}";
        $checkInterval = 120; // 2 minutes

        // Check if we've already done this check recently
        if (cache()->has($cacheKey)) {
            return;
        }

        // Mark that we're doing this check now
        cache()->put($cacheKey, true, $checkInterval);

        // Reset any stale in_progress actions (stuck for more than 5 minutes)
        $resetCount = ActionQueue::where('user_id', $user->id)
            ->where('status', self::STATUS_IN_PROGRESS)
            ->where('updated_at', '<', now()->subMinutes(5))
            ->update([
                'status' => self::STATUS_PENDING,
                'result' => 'Reset: Action was stuck in progress'
            ]);

        if ($resetCount > 0) {
            Log::info("Reset {$resetCount} stale actions for user {$user->id}");
        }
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
     * Atomically mark an action as in progress.
     * Only succeeds if the action is still in 'pending' status.
     * This prevents race conditions where multiple requests try to claim the same action.
     *
     * @param ActionQueue $action
     * @return bool True if successfully marked, false if already claimed
     */
    public function markInProgressAtomic(ActionQueue $action): bool
    {
        $updated = ActionQueue::where('id', $action->id)
            ->where('status', self::STATUS_PENDING)
            ->update([
                'status' => self::STATUS_IN_PROGRESS,
                'updated_at' => now(),
            ]);

        return $updated > 0;
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

                // Refresh campaign to get fresh data (avoid stale cached relation)
                $campaign = $action->campaign()->first();
                $totalSteps = $campaign->steps()->count();

                if ($campaignProspect->current_step >= $totalSteps) {
                    $campaignProspect->markCompleted();
                    $campaign->incrementProcessedProspects();
                    $campaign->incrementSuccessCount();
                }

                // Refresh again after incrementing for accurate completion check
                $campaign->refresh();
            }

            // Check campaign completion with fresh data
            $this->checkCampaignCompletion($action->campaign()->first());

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
     * @return array{success: bool, retry_scheduled: bool} Result with retry info
     */
    public function markFailed(ActionQueue $action, string $error, bool $retry = false): array
    {
        DB::beginTransaction();

        // Check retry eligibility BEFORE incrementing (max 3 retries = attempts 1, 2, 3)
        $canRetry = $retry && $action->retry_count < 3;
        $retryScheduled = false;

        try {
            if ($canRetry) {
                // Retry: increment count and reschedule for 5 minutes later
                $action->retry_count++;
                $action->scheduled_for = now()->addMinutes(5);
                $action->status = self::STATUS_PENDING;
                $action->result = "Retry {$action->retry_count}: {$error}";
                $retryScheduled = true;
            } else {
                // Final failure
                $action->status = self::STATUS_FAILED;
                $action->executed_at = now();
                $action->result = $error;

                // Mark campaign prospect as failed
                $campaignProspect = $action->campaignProspect;
                if ($campaignProspect) {
                    $campaignProspect->markFailed($error);

                    // Refresh campaign to get fresh data (avoid stale cached relation)
                    $campaign = $action->campaign()->first();
                    $campaign->incrementProcessedProspects();
                    $campaign->incrementFailureCount();
                    $campaign->refresh();
                }

                // Cancel remaining actions for this prospect in this campaign
                $this->cancelRemainingActions($action);
            }

            $action->save();

            // Check if campaign is done with fresh data
            $this->checkCampaignCompletion($action->campaign()->first());

            DB::commit();
            return ['success' => true, 'retry_scheduled' => $retryScheduled];

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Failed to mark action {$action->id} as failed: " . $e->getMessage());
            return ['success' => false, 'retry_scheduled' => false];
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
     * OPTIMIZATION: Uses single query with conditional aggregation instead of 6 separate queries.
     *
     * @param User $user
     * @return array
     */
    public function getStats(User $user): array
    {
        $today = today()->toDateString();

        $stats = ActionQueue::where('user_id', $user->id)
            ->selectRaw("SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as pending", [self::STATUS_PENDING])
            ->selectRaw("SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as in_progress", [self::STATUS_IN_PROGRESS])
            ->selectRaw("SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as completed", [self::STATUS_COMPLETED])
            ->selectRaw("SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as failed", [self::STATUS_FAILED])
            ->selectRaw("SUM(CASE WHEN status = ? AND DATE(executed_at) = ? THEN 1 ELSE 0 END) as today_completed", [self::STATUS_COMPLETED, $today])
            ->selectRaw("SUM(CASE WHEN status = ? AND DATE(executed_at) = ? THEN 1 ELSE 0 END) as today_failed", [self::STATUS_FAILED, $today])
            ->first();

        return [
            'pending' => (int) ($stats->pending ?? 0),
            'in_progress' => (int) ($stats->in_progress ?? 0),
            'completed' => (int) ($stats->completed ?? 0),
            'failed' => (int) ($stats->failed ?? 0),
            'today_completed' => (int) ($stats->today_completed ?? 0),
            'today_failed' => (int) ($stats->today_failed ?? 0),
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
