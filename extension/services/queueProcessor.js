/**
 * Queue Processor Service
 *
 * Manages the action queue execution flow:
 * 1. Verifies LinkedIn account matches backend user
 * 2. Polls for next action
 * 3. Executes action on LinkedIn
 * 4. Reports result back to backend
 * 5. Waits with human-like delay
 * 6. Repeats
 *
 * Uses sessionStorage to persist state across page navigations.
 *
 * @module services/queueProcessor
 */

// Queue state constants
const QUEUE_STATE_KEY = 'linkedin_automation_queue_state';
const QUEUE_RUNNING_KEY = 'linkedin_automation_queue_running';
const QUEUE_CURRENT_ACTION_KEY = 'linkedin_automation_current_action';
const QUEUE_VERIFIED_KEY = 'linkedin_automation_verified';

/**
 * Queue Processor Class
 * Handles the main automation loop
 */
class QueueProcessor {
  constructor() {
    this.isRunning = false;
    this.isPaused = false;
    this.currentAction = null;
    this.stats = {
      completed: 0,
      failed: 0,
      startedAt: null
    };
    this.onStatusChange = null; // Callback for UI updates
    this.onError = null; // Callback for errors
    this.accountVerified = false;
  }

  /**
   * Initialize the queue processor
   * Checks if there's a running queue to resume
   */
  async init() {
    console.log('[QueueProcessor] Initializing...');

    // Check if queue was running before page navigation
    const wasRunning = sessionStorage.getItem(QUEUE_RUNNING_KEY) === 'true';
    const savedAction = sessionStorage.getItem(QUEUE_CURRENT_ACTION_KEY);
    const wasVerified = sessionStorage.getItem(QUEUE_VERIFIED_KEY) === 'true';
    const needsVerify = sessionStorage.getItem('linkedin_automation_needs_verify') === 'true';

    if (wasRunning) {
      console.log('[QueueProcessor] Resuming queue after page navigation');

      // Clear the needs verify flag
      sessionStorage.removeItem('linkedin_automation_needs_verify');

      // If we navigated for verification, try to verify again
      if (needsVerify && !wasVerified) {
        console.log('[QueueProcessor] Retrying verification after navigation...');

        // Wait for page to fully load
        await this.sleep(3000);

        // Start fresh verification
        this.isRunning = true;
        const verified = await this.verifyAccount();

        if (!verified) {
          this.stop('Account verification failed');
          return;
        }

        // Continue with the queue
        await this.processLoop();
        return;
      }

      this.accountVerified = wasVerified;

      // Restore current action if we were in the middle of one
      if (savedAction) {
        try {
          this.currentAction = JSON.parse(savedAction);
          console.log('[QueueProcessor] Restored current action:', this.currentAction?.action_type);
        } catch (e) {
          console.error('[QueueProcessor] Failed to parse saved action');
        }
      }

      // Resume the queue
      await this.resume();
    }
  }

  /**
   * Start the queue processor
   */
  async start() {
    if (this.isRunning) {
      console.log('[QueueProcessor] Already running');
      return;
    }

    console.log('[QueueProcessor] Starting queue processor');
    this.isRunning = true;
    this.isPaused = false;
    this.stats.startedAt = new Date();

    // Save state
    sessionStorage.setItem(QUEUE_RUNNING_KEY, 'true');

    // Notify UI
    this.notifyStatus('running', 'Queue started');

    // Verify account first
    if (!this.accountVerified) {
      const verified = await this.verifyAccount();
      if (!verified) {
        this.stop('Account verification failed');
        return;
      }
    }

    // Start processing loop
    await this.processLoop();
  }

  /**
   * Resume the queue after page navigation
   */
  async resume() {
    console.log('[QueueProcessor] Resuming queue');
    this.isRunning = true;
    this.isPaused = false;

    // If we have a current action, complete it first
    if (this.currentAction) {
      console.log('[QueueProcessor] Completing interrupted action:', this.currentAction.action_type);

      // We navigated to the profile, now execute the action
      const result = await this.executeCurrentAction();

      // Report result to backend
      await this.reportActionResult(result);

      // Update stats
      if (result.success) {
        this.stats.completed++;
      } else {
        this.stats.failed++;
      }

      // Clear current action
      this.currentAction = null;
      sessionStorage.removeItem(QUEUE_CURRENT_ACTION_KEY);

      // Wait a bit to ensure backend has processed the completion
      console.log('[QueueProcessor] Waiting for backend to process completion...');
      await this.sleep(2000);
    }

    // Continue processing
    await this.processLoop();
  }

  /**
   * Pause the queue processor
   */
  pause() {
    console.log('[QueueProcessor] Pausing queue');
    this.isPaused = true;
    this.notifyStatus('paused', 'Queue paused');
  }

  /**
   * Stop the queue processor
   * @param {string} reason - Reason for stopping
   */
  stop(reason = 'User stopped') {
    console.log('[QueueProcessor] Stopping queue:', reason);
    this.isRunning = false;
    this.isPaused = false;
    this.currentAction = null;
    this.accountVerified = false;

    // Clear all session storage related to queue
    sessionStorage.removeItem(QUEUE_RUNNING_KEY);
    sessionStorage.removeItem(QUEUE_CURRENT_ACTION_KEY);
    sessionStorage.removeItem(QUEUE_VERIFIED_KEY);
    sessionStorage.removeItem('linkedin_automation_needs_verify');

    this.notifyStatus('stopped', reason);
  }

  /**
   * Verify that current LinkedIn account matches backend user
   * @returns {Promise<boolean>}
   */
  async verifyAccount() {
    console.log('[QueueProcessor] Verifying LinkedIn account...');
    this.notifyStatus('verifying', 'Verifying LinkedIn account...');

    try {
      // Check if we're on LinkedIn
      if (!window.location.href.includes('linkedin.com')) {
        this.notifyError('Please open LinkedIn to start the campaign');
        return false;
      }

      // Wait a bit for the page to fully load
      await this.sleep(2000);

      // Get current user's profile URL from LinkedIn page
      let profileUrl = await window.ActionExecutor.getCurrentUserProfileUrl();

      // If we couldn't find profile URL, try navigating to feed first
      if (!profileUrl) {
        console.log('[QueueProcessor] Could not find profile URL, trying feed page...');

        // If not on feed, navigate there
        if (!window.location.href.includes('linkedin.com/feed')) {
          console.log('[QueueProcessor] Navigating to feed page to find profile...');
          this.notifyStatus('verifying', 'Navigating to feed to detect profile...');

          // Store state before navigation
          sessionStorage.setItem(QUEUE_RUNNING_KEY, 'true');
          sessionStorage.setItem('linkedin_automation_needs_verify', 'true');

          window.location.href = 'https://www.linkedin.com/feed/';
          return false; // Will retry after navigation
        }

        // We're on feed but still can't find profile
        // Try one more time after a longer wait
        await this.sleep(3000);
        profileUrl = await window.ActionExecutor.getCurrentUserProfileUrl();

        if (!profileUrl) {
          console.warn('[QueueProcessor] Still could not detect profile URL');

          // Last resort: try to extract from page source or cookies
          profileUrl = this.tryAlternativeProfileDetection();

          if (!profileUrl) {
            // Allow proceeding anyway with a warning - the backend check will catch mismatches
            console.warn('[QueueProcessor] Proceeding without profile URL verification');
            this.notifyStatus('warning', 'Could not verify profile URL, proceeding with caution...');

            // Mark as verified but log warning
            this.accountVerified = true;
            sessionStorage.setItem(QUEUE_VERIFIED_KEY, 'true');
            return true;
          }
        }
      }

      console.log('[QueueProcessor] Current user profile:', profileUrl);

      // Verify with backend
      const response = await verifyLinkedInAccount(profileUrl);

      if (response.success && response.verified) {
        console.log('[QueueProcessor] Account verified successfully');
        this.accountVerified = true;
        sessionStorage.setItem(QUEUE_VERIFIED_KEY, 'true');
        this.notifyStatus('verified', `Account verified: ${response.linkedin_account?.full_name || 'Success'}`);
        return true;
      } else {
        console.error('[QueueProcessor] Account verification failed:', response.message);
        this.notifyError(response.message || 'Account verification failed');
        return false;
      }

    } catch (error) {
      console.error('[QueueProcessor] Account verification error:', error);
      this.notifyError(`Verification error: ${error.message}`);
      return false;
    }
  }

  /**
   * Try alternative methods to detect current user's profile
   * IMPORTANT: Must only find the LOGGED-IN user, not the profile being viewed
   * @returns {string|null}
   */
  tryAlternativeProfileDetection() {
    console.log('[QueueProcessor] Trying alternative profile detection...');

    // Method 1: Look specifically in the global-nav for profile links
    // The global-nav is the top navigation bar which always shows the logged-in user
    const globalNav = document.querySelector('.global-nav');
    if (globalNav) {
      // Look for the Me menu area specifically
      const meArea = globalNav.querySelector('.global-nav__me, .global-nav__me-trigger');
      if (meArea) {
        const parentLink = meArea.closest('a[href*="/in/"]');
        if (parentLink && parentLink.href) {
          console.log('[QueueProcessor] Found profile link from Me area:', parentLink.href);
          return parentLink.href;
        }
      }
    }

    // Method 2: Feed identity module (only on feed page)
    // This specifically shows the current logged-in user
    if (window.location.href.includes('linkedin.com/feed')) {
      const feedIdentity = document.querySelector('.feed-identity-module a[href*="/in/"]');
      if (feedIdentity && feedIdentity.href) {
        console.log('[QueueProcessor] Found profile link from feed identity:', feedIdentity.href);
        return feedIdentity.href;
      }
    }

    // Method 3: Try to find the profile photo in nav which links to profile
    // Be specific - only look in the global nav header area
    const navPhoto = document.querySelector('.global-nav img.global-nav__me-photo');
    if (navPhoto) {
      const parentLink = navPhoto.closest('a[href*="/in/"]');
      if (parentLink && parentLink.href) {
        console.log('[QueueProcessor] Found profile link from nav photo:', parentLink.href);
        return parentLink.href;
      }
    }

    // DO NOT check sidebar or left rail - those show the VIEWED profile, not the current user!
    console.log('[QueueProcessor] Could not find current user profile via alternative methods');
    return null;
  }

  /**
   * Main processing loop
   */
  async processLoop() {
    console.log('[QueueProcessor] Starting process loop');

    let noActionCount = 0; // Track consecutive "no action" responses
    const MAX_NO_ACTION_CHECKS = 3; // Stop after 3 consecutive "no action" responses

    while (this.isRunning && !this.isPaused) {
      try {
        // Get next action from backend
        const response = await getNextAction();

        if (!response.success) {
          console.error('[QueueProcessor] Failed to get next action:', response);
          await this.sleep(30000); // Wait 30 seconds before retry
          continue;
        }

        // Check if there's an action to execute
        if (!response.has_action || !response.action) {
          noActionCount++;
          console.log(`[QueueProcessor] No pending actions (check ${noActionCount}/${MAX_NO_ACTION_CHECKS})`);

          // If we've checked multiple times and still no actions, campaign is likely done
          if (noActionCount >= MAX_NO_ACTION_CHECKS) {
            console.log('[QueueProcessor] No more actions after multiple checks. Campaign completed!');
            this.notifyStatus('completed', 'All actions completed! Campaign finished.');
            this.stop('Campaign completed - no more actions');

            // Close this tab or navigate away
            try {
              // Get the last action's campaign info for the completion notification
              const lastAction = this.currentAction;
              const campaignId = lastAction?.campaign_id || null;
              const actionType = lastAction?.action_type || null;

              // Notify user (include campaign info for email modal)
              chrome.runtime.sendMessage({
                type: 'CAMPAIGN_COMPLETED',
                stats: this.stats,
                campaignId: campaignId,
                actionType: actionType
              }).catch(() => {});

              // Navigate to LinkedIn feed instead of closing tab
              window.location.href = 'https://www.linkedin.com/feed/';
            } catch (e) {
              console.log('[QueueProcessor] Could not navigate away');
            }

            return;
          }

          this.notifyStatus('waiting', `No pending actions. Checking again in 30s... (${noActionCount}/${MAX_NO_ACTION_CHECKS})`);

          // Wait before checking again (30 seconds)
          await this.sleep(30000);
          continue;
        }

        // Reset counter when we find an action
        noActionCount = 0;

        // Check daily limit
        if (response.remaining_today <= 0) {
          console.log('[QueueProcessor] Daily limit reached');
          this.notifyStatus('limit_reached', 'Daily limit reached. Will resume tomorrow.');
          this.stop('Daily limit reached');
          return;
        }

        // Store current action
        this.currentAction = response.action;
        sessionStorage.setItem(QUEUE_CURRENT_ACTION_KEY, JSON.stringify(this.currentAction));

        this.notifyStatus('executing', `Executing: ${this.currentAction.action_type} for ${this.currentAction.prospect.full_name}`);

        // Execute the action
        const result = await this.executeCurrentAction();

        // Check if we navigated away (page will reload)
        if (result.navigating) {
          console.log('[QueueProcessor] Navigating to profile, will resume after load');
          return; // Exit - will resume after page load
        }

        // Report result to backend
        await this.reportActionResult(result);

        // Update stats
        if (result.success) {
          this.stats.completed++;
        } else {
          this.stats.failed++;
        }

        // Clear current action
        this.currentAction = null;
        sessionStorage.removeItem(QUEUE_CURRENT_ACTION_KEY);

        // Human-like delay between actions (25-45 seconds)
        const delay = window.ActionExecutor.getRandomDelay(25000, 45000);
        console.log(`[QueueProcessor] Waiting ${Math.round(delay / 1000)} seconds before next action`);
        this.notifyStatus('waiting', `Waiting ${Math.round(delay / 1000)}s before next action...`);

        await this.sleep(delay);

      } catch (error) {
        console.error('[QueueProcessor] Error in process loop:', error);

        // Check if extension was reloaded
        if (error.message.includes('Extension') &&
            (error.message.includes('invalidated') || error.message.includes('reloaded'))) {
          this.notifyError('Extension was reloaded. Please refresh LinkedIn page.');
          this.stop('Extension context lost');
          return;
        }

        this.notifyError(`Error: ${error.message}`);

        // Wait before retry
        await this.sleep(30000);
      }
    }

    console.log('[QueueProcessor] Process loop ended');
  }

  /**
   * Execute the current action
   * @returns {Promise<{success: boolean, message: string, navigating?: boolean}>}
   */
  async executeCurrentAction() {
    if (!this.currentAction) {
      return { success: false, message: 'No action to execute' };
    }

    try {
      return await window.ActionExecutor.executeAction(this.currentAction);
    } catch (error) {
      console.error('[QueueProcessor] Action execution error:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Report action result to backend
   * @param {object} result - Execution result
   */
  async reportActionResult(result) {
    if (!this.currentAction) {
      console.warn('[QueueProcessor] No current action to report');
      return;
    }

    try {
      const status = result.success ? 'completed' : 'failed';
      const resultMessage = result.success ? result.message : null;
      const errorMessage = result.success ? null : result.message;
      const shouldRetry = !result.success && result.message?.includes('Could not find');

      console.log(`[QueueProcessor] Reporting action ${this.currentAction.id} as ${status}`);

      await completeAction(
        this.currentAction.id,
        status,
        resultMessage,
        errorMessage,
        shouldRetry
      );

      this.notifyStatus(
        result.success ? 'action_completed' : 'action_failed',
        result.message
      );

    } catch (error) {
      console.error('[QueueProcessor] Failed to report action result:', error);
      this.notifyError(`Failed to report result: ${error.message}`);
    }
  }

  /**
   * Sleep helper
   * @param {number} ms - Milliseconds
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Notify status change
   * @param {string} status - Current status
   * @param {string} message - Status message
   */
  notifyStatus(status, message) {
    console.log(`[QueueProcessor] Status: ${status} - ${message}`);

    if (this.onStatusChange) {
      this.onStatusChange({
        status,
        message,
        stats: this.stats,
        currentAction: this.currentAction
      });
    }

    // Send message to popup/background
    try {
      chrome.runtime.sendMessage({
        type: 'QUEUE_STATUS',
        status,
        message,
        stats: this.stats
      }).catch(() => {
        // Ignore if no listeners
      });
    } catch (e) {
      // Ignore
    }
  }

  /**
   * Notify error
   * @param {string} message - Error message
   */
  notifyError(message) {
    console.error(`[QueueProcessor] Error: ${message}`);

    if (this.onError) {
      this.onError(message);
    }

    // Send message to popup/background
    try {
      chrome.runtime.sendMessage({
        type: 'QUEUE_ERROR',
        message
      }).catch(() => {
        // Ignore if no listeners
      });
    } catch (e) {
      // Ignore
    }
  }

  /**
   * Get current status
   * @returns {object}
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      accountVerified: this.accountVerified,
      currentAction: this.currentAction,
      stats: this.stats
    };
  }
}

// Create global instance
const queueProcessor = new QueueProcessor();

// Export for use in content script
if (typeof window !== 'undefined') {
  window.QueueProcessor = queueProcessor;
}
