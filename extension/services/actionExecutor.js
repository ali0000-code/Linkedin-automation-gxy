/**
 * Action Executor Service
 *
 * Executes LinkedIn actions (visit, invite, message, follow) on profile pages.
 * Based on reference extension implementation - exact working logic.
 *
 * @module services/actionExecutor
 */

/**
 * Sleep for a specified number of milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get random delay between min and max
 * @param {number} min - Minimum milliseconds
 * @param {number} max - Maximum milliseconds
 * @returns {number}
 */
function getRandomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Extract LinkedIn ID from profile URL
 * @param {string} profileUrl - Full LinkedIn profile URL
 * @returns {string|null} LinkedIn ID or null
 */
function extractLinkedInIdFromUrl(profileUrl) {
  if (!profileUrl) return null;
  const match = profileUrl.match(/\/in\/([^\/\?]+)/);
  return match ? match[1] : null;
}

/**
 * Get the MAIN profile action container
 * This is critical to avoid clicking wrong buttons (duplicates elsewhere on page)
 * Based on reference extension: getMainProfileActionContainer()
 * @returns {Element|null}
 */
function getMainProfileActionContainer() {
  const selectors = window.LINKEDIN_SELECTORS;
  if (!selectors) {
    console.error('[ActionExecutor] Selectors not loaded');
    return null;
  }

  // Find profile action container
  const containers = document.querySelectorAll(selectors.PROFILE.ACTION_CONTAINER);

  for (const container of containers) {
    // Validate: container must have at least one action button
    const hasActionButtons = container.querySelector(selectors.PROFILE.ACTION_BUTTON_CHECK);
    if (hasActionButtons) {
      console.log('[ActionExecutor] Found main profile action container');
      return container;
    }
  }

  // Fallback 1: look for section that contains both Message and More buttons
  const sections = document.querySelectorAll(selectors.PROFILE.FALLBACK_SECTIONS);
  for (const section of sections) {
    const messageBtn = section.querySelector('button[aria-label*="Message"]');
    const moreBtn = section.querySelector('button[aria-label*="More"]');
    if (messageBtn && moreBtn) {
      console.log('[ActionExecutor] Found main profile action container (section fallback)');
      return section;
    }
  }

  // Fallback 2: Find Message button and get its parent container
  // LinkedIn sometimes uses randomized class names, so we find buttons directly
  const messageButton = document.querySelector('button[aria-label*="Message"]');
  if (messageButton) {
    // Go up to find a container that also has the More button
    let parent = messageButton.parentElement;
    let attempts = 0;
    while (parent && attempts < 10) {
      const moreBtn = parent.querySelector('button[aria-label="More actions"], button[aria-label*="More"]');
      if (moreBtn) {
        console.log('[ActionExecutor] Found main profile action container (button parent fallback)');
        return parent;
      }
      parent = parent.parentElement;
      attempts++;
    }

    // If we found Message but not More in parent, still return a reasonable container
    const container = messageButton.closest('div[class]');
    if (container) {
      console.log('[ActionExecutor] Found main profile action container (message button container)');
      return container;
    }
  }

  // Fallback 3: Find any Connect or Follow button and get container
  const connectOrFollow = document.querySelector('button[aria-label*="Invite"][aria-label*="connect"], button[aria-label*="Follow"]:not([aria-label*="Following"])');
  if (connectOrFollow) {
    let parent = connectOrFollow.parentElement;
    let attempts = 0;
    while (parent && attempts < 10) {
      const moreBtn = parent.querySelector('button[aria-label="More actions"], button[aria-label*="More"]');
      if (moreBtn) {
        console.log('[ActionExecutor] Found main profile action container (connect/follow parent fallback)');
        return parent;
      }
      parent = parent.parentElement;
      attempts++;
    }
  }

  console.warn('[ActionExecutor] Could not find main profile action container');
  return null;
}

/**
 * Get current user's LinkedIn profile URL from the page
 * IMPORTANT: Must only return the LOGGED-IN user's profile, not the profile being viewed
 * @returns {Promise<string|null>}
 */
async function getCurrentUserProfileUrl() {
  console.log('[ActionExecutor] Getting current user profile URL...');

  // Method 1: Profile card in left sidebar (MOST RELIABLE - always shows logged-in user)
  // This card appears on feed page and has class "profile-card"
  const profileCardSelectors = [
    '.profile-card a.profile-card-profile-picture-container[href*="/in/"]',
    '.profile-card a.profile-card-profile-link[href*="/in/"]',
    '.profile-card a[href*="/in/"]',
    '.artdeco-card.profile-card a[href*="/in/"]'
  ];

  for (const selector of profileCardSelectors) {
    const profileLink = document.querySelector(selector);
    if (profileLink && profileLink.href && profileLink.href.includes('/in/')) {
      console.log('[ActionExecutor] Found profile URL from profile card:', profileLink.href);
      return profileLink.href;
    }
  }

  // Method 2: Feed identity module (older LinkedIn UI)
  const feedProfileSelectors = [
    '.feed-identity-module__actor-meta a[href*="/in/"]',
    '.feed-identity-module a[href*="/in/"]',
    '.feed-identity-module__content a[href*="/in/"]'
  ];

  for (const selector of feedProfileSelectors) {
    const feedProfile = document.querySelector(selector);
    if (feedProfile && feedProfile.href) {
      console.log('[ActionExecutor] Found profile URL from feed identity module:', feedProfile.href);
      return feedProfile.href;
    }
  }

  // Method 3: Check the global nav "Me" dropdown (fallback)
  const meButtonSelectors = [
    '.global-nav__me-trigger',
    '.global-nav__me button',
    '.global-nav__me'
  ];

  let meButton = null;
  for (const selector of meButtonSelectors) {
    meButton = document.querySelector(selector);
    if (meButton) break;
  }

  if (meButton) {
    console.log('[ActionExecutor] Clicking Me button to find profile...');
    meButton.click();
    await sleep(1500);

    const dropdownSelectors = [
      '.global-nav__me-content a[href*="/in/"]',
      '.artdeco-dropdown__content-inner a[href*="/in/"]',
      '.artdeco-dropdown__content a[href*="/in/"]'
    ];

    for (const selector of dropdownSelectors) {
      const link = document.querySelector(selector);
      if (link && link.href && link.href.includes('/in/')) {
        const url = link.href;
        console.log('[ActionExecutor] Found profile URL from Me dropdown:', url);
        document.body.click();
        await sleep(200);
        return url;
      }
    }

    document.body.click();
    await sleep(200);
  }

  console.error('[ActionExecutor] Could not find current user profile URL');
  console.log('[ActionExecutor] Current page:', window.location.href);
  return null;
}

/**
 * Check if we're on a profile page
 * @returns {boolean}
 */
function isProfilePage() {
  return window.location.href.includes('linkedin.com/in/');
}

/**
 * Execute a VISIT action (just viewing the profile)
 * @param {object} action - Action data from API
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function executeVisit(action) {
  console.log('[ActionExecutor] Executing VISIT action for:', action.prospect.full_name);

  try {
    const profileUrl = action.prospect.profile_url;
    const linkedinId = action.prospect.linkedin_id || extractLinkedInIdFromUrl(profileUrl);

    // Check if we're already on this profile by comparing LinkedIn ID
    const currentUrl = window.location.href;
    const isOnProfile = currentUrl.includes('/in/') &&
                        (currentUrl.includes(linkedinId) || currentUrl.includes(profileUrl.replace('https://www.linkedin.com', '')));

    console.log(`[ActionExecutor] Visit - LinkedIn ID: ${linkedinId}, On profile: ${isOnProfile}`);

    // Navigate to profile if not already there
    if (!isOnProfile) {
      console.log('[ActionExecutor] Navigating to profile:', profileUrl);
      window.location.href = profileUrl;
      return { success: true, message: 'Navigating to profile', navigating: true };
    }

    console.log('[ActionExecutor] Already on profile, proceeding with visit...');

    // Already on profile, wait for page to fully load
    await sleep(getRandomDelay(2000, 4000));

    // Scroll down to simulate viewing
    window.scrollBy({ top: getRandomDelay(300, 600), behavior: 'smooth' });
    await sleep(getRandomDelay(1000, 2000));

    return { success: true, message: `Visited profile: ${action.prospect.full_name}` };
  } catch (error) {
    console.error('[ActionExecutor] Visit failed:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Execute an INVITE (connection request) action
 * Based on reference extension: sendConnectionRequest()
 * @param {object} action - Action data from API
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function executeInvite(action) {
  console.log('[ActionExecutor] Executing INVITE action for:', action.prospect.full_name);

  const selectors = window.LINKEDIN_SELECTORS;
  if (!selectors) {
    return { success: false, message: 'Selectors not loaded' };
  }

  try {
    const profileUrl = action.prospect.profile_url;
    const linkedinId = action.prospect.linkedin_id || extractLinkedInIdFromUrl(profileUrl);

    // Check if we're already on this profile by comparing LinkedIn ID
    const currentUrl = window.location.href;
    const isOnProfile = currentUrl.includes('/in/') &&
                        (currentUrl.includes(linkedinId) || currentUrl.includes(profileUrl.replace('https://www.linkedin.com', '')));

    console.log(`[ActionExecutor] Invite - LinkedIn ID: ${linkedinId}, On profile: ${isOnProfile}`);

    // Navigate to profile if not already there
    if (!isOnProfile) {
      console.log('[ActionExecutor] Navigating to profile for invite:', profileUrl);
      window.location.href = profileUrl;
      return { success: true, message: 'Navigating to profile', navigating: true };
    }

    console.log('[ActionExecutor] Already on profile, proceeding with invite...');

    // Wait for page to load
    await sleep(3000);

    // Get main profile action container with retries
    let actionContainer = null;
    let retryCount = 0;
    const maxRetries = 5;

    while (!actionContainer && retryCount < maxRetries) {
      actionContainer = getMainProfileActionContainer();
      if (!actionContainer) {
        retryCount++;
        console.log(`[ActionExecutor] Action container not found, retry ${retryCount}/${maxRetries}...`);
        await sleep(1500);
      }
    }

    if (!actionContainer) {
      return { success: false, message: 'Could not find profile action buttons after retries' };
    }

    await sleep(500);

    // Check if already pending
    const pendingButton = actionContainer.querySelector(selectors.PROFILE.PENDING_BUTTON);
    if (pendingButton) {
      console.log('[ActionExecutor] Connection request already pending');
      return { success: true, message: 'Connection request already pending' };
    }

    // Try to find visible Connect button first (primary button) with retries
    let connectButton = null;
    let connectRetry = 0;
    const maxConnectRetries = 3;

    while (!connectButton && connectRetry < maxConnectRetries) {
      connectButton = actionContainer.querySelector(selectors.PROFILE.CONNECT_BUTTON);
      if (!connectButton) {
        connectRetry++;
        console.log(`[ActionExecutor] Connect button not visible yet, retry ${connectRetry}/${maxConnectRetries}...`);
        await sleep(1000);
      }
    }

    // If Connect not visible after retries, check More menu
    if (!connectButton) {
      console.log('[ActionExecutor] Connect button not visible, checking More menu...');
      await sleep(1000);

      // Find More button in container with retries
      let moreButton = null;
      let moreRetry = 0;
      const maxMoreRetries = 3;

      while (!moreButton && moreRetry < maxMoreRetries) {
        moreButton = actionContainer.querySelector(selectors.PROFILE.MORE_BUTTON);

        // Fallback: look for button with text "More"
        if (!moreButton) {
          const buttons = actionContainer.querySelectorAll('button');
          for (const btn of buttons) {
            if (btn.textContent.trim() === 'More') {
              moreButton = btn;
              break;
            }
          }
        }

        if (!moreButton) {
          moreRetry++;
          console.log(`[ActionExecutor] More button not found, retry ${moreRetry}/${maxMoreRetries}...`);
          await sleep(1500);
        }
      }

      if (!moreButton) {
        console.error('[ActionExecutor] More button not found after retries');
        return { success: false, message: 'Could not find Connect or More button' };
      }

      // Scroll More button into view
      moreButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(500);

      console.log('[ActionExecutor] Clicking More button...');
      moreButton.click();

      // Wait for dropdown to appear
      await sleep(2000);

      // Find Connect in dropdown (dropdown appears in body, not in container)
      connectButton = document.querySelector(selectors.PROFILE.DROPDOWN_CONNECT);

      if (!connectButton) {
        console.error('[ActionExecutor] Connect button not found in More menu');
        return { success: false, message: 'Connect option not found in More menu' };
      }

      await sleep(500);
    }

    // Click Connect button
    console.log('[ActionExecutor] Clicking Connect button...');
    connectButton.click();

    // Wait for modal to appear
    console.log('[ActionExecutor] Waiting for connection modal...');
    await sleep(3000);

    // Check for Add note and Send without note buttons
    const addNoteButton = document.querySelector(selectors.CONNECTION_MODAL.ADD_NOTE_BUTTON);
    const sendWithoutNoteButton = document.querySelector(selectors.CONNECTION_MODAL.SEND_WITHOUT_NOTE);

    // If neither button exists, LinkedIn limit may have been reached
    if (!addNoteButton && !sendWithoutNoteButton) {
      console.warn('[ActionExecutor] LinkedIn connection limit may have been reached');
      const dismissButton = document.querySelector(selectors.CONNECTION_MODAL.DISMISS_BUTTON);
      if (dismissButton) {
        dismissButton.click();
        await sleep(500);
      }
      return { success: false, message: 'LinkedIn connection limit reached or modal did not appear' };
    }

    // Get message if provided
    const message = action.action_data?.message;

    if (message && message.trim() !== '') {
      // Add note flow
      console.log('[ActionExecutor] Adding note to connection request...');

      if (!addNoteButton) {
        console.error('[ActionExecutor] Add note button not found');
        return { success: false, message: 'Add note button not found' };
      }

      await sleep(500);
      console.log('[ActionExecutor] Clicking Add a note button...');
      addNoteButton.click();

      // Wait for textarea to appear
      console.log('[ActionExecutor] Waiting for note textarea...');
      await sleep(2000);

      // Find the note textarea
      const noteTextarea = document.querySelector(selectors.CONNECTION_MODAL.NOTE_TEXTAREA);
      if (!noteTextarea) {
        console.error('[ActionExecutor] Note textarea not found');
        return { success: false, message: 'Note textarea not found' };
      }

      console.log('[ActionExecutor] Found note textarea, typing message...');
      await sleep(500);

      // Focus and set value
      noteTextarea.focus();
      await sleep(300);
      noteTextarea.value = message;

      // Trigger input event so LinkedIn recognizes the change
      noteTextarea.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(500);

      console.log('[ActionExecutor] Message entered successfully');

      // Click Send invitation button
      console.log('[ActionExecutor] Looking for Send button...');
      await sleep(500);

      const sendButton = document.querySelector(selectors.CONNECTION_MODAL.SEND_BUTTON);
      if (!sendButton) {
        console.error('[ActionExecutor] Send button not found');
        return { success: false, message: 'Send button not found' };
      }

      console.log('[ActionExecutor] Clicking Send button...');
      sendButton.click();
      await sleep(1000);

      console.log('[ActionExecutor] Connection request sent with note');
      return { success: true, message: `Connection request sent with note to ${action.prospect.full_name}` };

    } else {
      // Send without note
      console.log('[ActionExecutor] Sending connection request without note...');

      if (!sendWithoutNoteButton) {
        console.error('[ActionExecutor] Send without a note button not found');
        return { success: false, message: 'Send without a note button not found' };
      }

      await sleep(500);
      console.log('[ActionExecutor] Clicking Send without a note button...');
      sendWithoutNoteButton.click();
      await sleep(1000);

      console.log('[ActionExecutor] Connection request sent without note');
      return { success: true, message: `Connection request sent to ${action.prospect.full_name}` };
    }

  } catch (error) {
    console.error('[ActionExecutor] Invite failed:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Execute a FOLLOW action
 * Similar to connect but clicks Follow instead
 * @param {object} action - Action data from API
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function executeFollow(action) {
  console.log('[ActionExecutor] Executing FOLLOW action for:', action.prospect.full_name);

  const selectors = window.LINKEDIN_SELECTORS;
  if (!selectors) {
    return { success: false, message: 'Selectors not loaded' };
  }

  try {
    const profileUrl = action.prospect.profile_url;
    const linkedinId = action.prospect.linkedin_id || extractLinkedInIdFromUrl(profileUrl);

    // Check if we're already on this profile by comparing LinkedIn ID
    const currentUrl = window.location.href;
    const isOnProfile = currentUrl.includes('/in/') &&
                        (currentUrl.includes(linkedinId) || currentUrl.includes(profileUrl.replace('https://www.linkedin.com', '')));

    console.log(`[ActionExecutor] URL check - LinkedIn ID: ${linkedinId}, Current URL: ${currentUrl}, On profile: ${isOnProfile}`);

    // Navigate to profile if not already there
    if (!isOnProfile) {
      console.log('[ActionExecutor] Navigating to profile...');
      window.location.href = profileUrl;
      return { success: true, message: 'Navigating to profile', navigating: true };
    }

    console.log('[ActionExecutor] Already on profile, proceeding with follow action...');

    // Wait for page to load
    await sleep(2000);

    // Get main profile action container
    const actionContainer = getMainProfileActionContainer();
    if (!actionContainer) {
      return { success: false, message: 'Could not find profile action buttons' };
    }

    await sleep(500);

    // Wait for page to fully stabilize
    await sleep(1500);

    // Check if already following (look for "Following" button ONLY in main action container)
    const alreadyFollowing = actionContainer.querySelector('button[aria-label*="Following"]');
    if (alreadyFollowing) {
      console.log('[ActionExecutor] Already following this person');
      return { success: true, message: 'Already following this person' };
    }

    // Try to find visible Follow button ONLY within the main action container
    // This avoids clicking Follow buttons for recommended users in sidebar
    let followButton = actionContainer.querySelector(selectors.PROFILE.FOLLOW_BUTTON) ||
                       actionContainer.querySelector('button[aria-label*="Follow"]:not([aria-label*="Following"])');

    // Verify the button is for the main profile (should be in action container)
    if (followButton) {
      console.log('[ActionExecutor] Found Follow button in main action container, clicking...');
      followButton.click();
      await sleep(1000);
      console.log('[ActionExecutor] Now following this person');
      return { success: true, message: `Now following ${action.prospect.full_name}` };
    }

    // Follow not visible in action container, need to check More menu
    console.log('[ActionExecutor] Follow button not visible in action container, checking More menu...');
    await sleep(1000);

    // Find More button ONLY within the main action container - try multiple times
    let moreButton = null;
    let retryCount = 0;
    const maxRetries = 3;

    while (!moreButton && retryCount < maxRetries) {
      moreButton = actionContainer.querySelector(selectors.PROFILE.MORE_BUTTON) ||
                   actionContainer.querySelector('button[aria-label*="More actions"]') ||
                   actionContainer.querySelector('button[aria-label="More"]');

      // Fallback: look for button containing "More" text within action container only
      if (!moreButton) {
        const buttons = actionContainer.querySelectorAll('button');
        for (const btn of buttons) {
          const text = btn.textContent.trim();
          const ariaLabel = btn.getAttribute('aria-label') || '';
          if (text === 'More' || ariaLabel.includes('More')) {
            moreButton = btn;
            console.log('[ActionExecutor] Found More button via text/aria search in action container');
            break;
          }
        }
      }

      if (!moreButton) {
        retryCount++;
        console.log(`[ActionExecutor] More button not found, retry ${retryCount}/${maxRetries}...`);
        await sleep(1500);
      }
    }

    if (!moreButton) {
      console.error('[ActionExecutor] More button not found in action container after retries');
      return { success: false, message: 'Could not find Follow or More button in main profile actions' };
    }

    // Scroll the More button into view to ensure it's clickable
    moreButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(500);

    console.log('[ActionExecutor] Clicking More button...');
    moreButton.click();

    // Wait for dropdown to appear
    await sleep(1500);

    // Find Follow in dropdown - look for the dropdown item with aria-label containing "Follow"
    // The HTML structure is: div.artdeco-dropdown__item[aria-label*="Follow"][role="button"]
    followButton = document.querySelector('div.artdeco-dropdown__item[aria-label*="Follow"][role="button"]') ||
                   document.querySelector('.artdeco-dropdown__content div[aria-label*="Follow"][role="button"]');

    // Fallback: search all dropdown items for one with "Follow" in aria-label
    if (!followButton) {
      const dropdownItems = document.querySelectorAll('div.artdeco-dropdown__item[role="button"]');
      console.log(`[ActionExecutor] Searching ${dropdownItems.length} dropdown items for Follow...`);

      for (const item of dropdownItems) {
        const ariaLabel = item.getAttribute('aria-label') || '';
        const text = item.textContent.trim();
        console.log(`[ActionExecutor] Dropdown item: aria-label="${ariaLabel}", text="${text}"`);

        // Match aria-label starting with "Follow " (e.g., "Follow somia faisal")
        // but not "Following" or "Unfollow"
        if (ariaLabel.startsWith('Follow ') && !ariaLabel.includes('Following') && !ariaLabel.includes('Unfollow')) {
          followButton = item;
          console.log('[ActionExecutor] Found Follow button via aria-label search');
          break;
        }

        // Also check if text content is exactly "Follow"
        if (text === 'Follow') {
          followButton = item;
          console.log('[ActionExecutor] Found Follow button via text search');
          break;
        }
      }
    }

    if (!followButton) {
      // Close dropdown by pressing Escape
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27 }));
      await sleep(300);
      console.error('[ActionExecutor] Follow button not found in More menu dropdown');
      return { success: false, message: 'Follow option not found in More menu' };
    }

    await sleep(300);

    // Click Follow button in dropdown
    console.log('[ActionExecutor] Clicking Follow button in dropdown...');
    followButton.click();
    await sleep(1000);

    console.log('[ActionExecutor] Now following this person');
    return { success: true, message: `Now following ${action.prospect.full_name}` };

  } catch (error) {
    console.error('[ActionExecutor] Follow failed:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Execute a MESSAGE action (for 1st degree connections)
 * Based on reference extension: sendFollowUpMessage()
 * @param {object} action - Action data from API
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function executeMessage(action) {
  console.log('[ActionExecutor] Executing MESSAGE action for:', action.prospect.full_name);

  const selectors = window.LINKEDIN_SELECTORS;
  if (!selectors) {
    return { success: false, message: 'Selectors not loaded' };
  }

  try {
    const profileUrl = action.prospect.profile_url;
    const linkedinId = action.prospect.linkedin_id || extractLinkedInIdFromUrl(profileUrl);

    // Check if we're already on this profile by comparing LinkedIn ID
    const currentUrl = window.location.href;
    const isOnProfile = currentUrl.includes('/in/') &&
                        (currentUrl.includes(linkedinId) || currentUrl.includes(profileUrl.replace('https://www.linkedin.com', '')));

    console.log(`[ActionExecutor] Message - LinkedIn ID: ${linkedinId}, On profile: ${isOnProfile}`);

    // Navigate to profile if not already there
    if (!isOnProfile) {
      console.log('[ActionExecutor] Navigating to profile for message:', profileUrl);
      window.location.href = profileUrl;
      return { success: true, message: 'Navigating to profile', navigating: true };
    }

    console.log('[ActionExecutor] Already on profile, proceeding with message...');

    // Wait for page to fully load
    await sleep(4000);

    // Get main profile action container with retries
    console.log('[ActionExecutor] Looking for Message button...');
    let actionContainer = null;
    let retryCount = 0;
    const maxRetries = 5;

    while (!actionContainer && retryCount < maxRetries) {
      actionContainer = getMainProfileActionContainer();
      if (!actionContainer) {
        retryCount++;
        console.log(`[ActionExecutor] Action container not found, retry ${retryCount}/${maxRetries}...`);
        await sleep(1500);
      }
    }

    if (!actionContainer) {
      return { success: false, message: 'Could not find profile action buttons after retries' };
    }

    await sleep(1000);

    // Find Message button in main profile area with retries
    let messageButton = null;
    let msgRetry = 0;
    const maxMsgRetries = 5;

    while (!messageButton && msgRetry < maxMsgRetries) {
      messageButton = actionContainer.querySelector(selectors.PROFILE.MESSAGE_BUTTON);
      if (!messageButton) {
        msgRetry++;
        console.log(`[ActionExecutor] Message button not found, retry ${msgRetry}/${maxMsgRetries}...`);
        await sleep(1500);
      }
    }

    if (!messageButton) {
      console.error('[ActionExecutor] Message button not found after retries');
      return { success: false, message: 'Message button not found (user may not be a 1st degree connection)' };
    }

    console.log('[ActionExecutor] Found Message button');
    await sleep(500);

    // Close any existing open message boxes first to ensure clean state
    console.log('[ActionExecutor] Closing any existing message boxes...');
    const existingCloseButtons = document.querySelectorAll('.msg-overlay-bubble-header__control[data-control-name="overlay.close_conversation_window"], .msg-overlay-bubble-header button[aria-label="Close your conversation"], button[aria-label="Close your conversation"]');
    for (const closeBtn of existingCloseButtons) {
      try {
        closeBtn.click();
        await sleep(300);
      } catch (e) {
        // Ignore errors
      }
    }
    await sleep(500);

    // Click Message button
    console.log('[ActionExecutor] Clicking Message button...');
    messageButton.click();

    // Wait for message compose area to appear
    console.log('[ActionExecutor] Waiting for message compose area...');
    await sleep(3000);

    // Find message textbox (contenteditable div)
    let messageTextbox = document.querySelector(selectors.MESSAGE.TEXTBOX);
    if (!messageTextbox) {
      console.error('[ActionExecutor] Message textbox not found');
      return { success: false, message: 'Message compose area did not appear' };
    }

    console.log('[ActionExecutor] Message textbox found');
    await sleep(500);

    // Get message content
    const messageContent = action.action_data?.message;
    if (!messageContent || messageContent.trim() === '') {
      console.error('[ActionExecutor] No message content provided');
      return { success: false, message: 'No message content provided' };
    }

    console.log('[ActionExecutor] Typing message...');

    // Focus the textbox
    messageTextbox.focus();
    await sleep(500);

    // Clear the textbox first
    messageTextbox.innerHTML = '<p><br></p>';
    messageTextbox.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(300);

    // Method 1: Set innerHTML with paragraph wrapper (LinkedIn's format)
    messageTextbox.focus();
    messageTextbox.innerHTML = `<p>${messageContent}</p>`;

    // Trigger input events to notify LinkedIn's React handlers
    messageTextbox.dispatchEvent(new Event('input', { bubbles: true }));
    messageTextbox.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(500);

    // Verify message was inserted
    const insertedText = messageTextbox.innerText.trim();
    console.log('[ActionExecutor] Inserted text length:', insertedText.length);

    if (!insertedText || insertedText.length < 3) {
      console.log('[ActionExecutor] Method 1 failed, trying insertText...');

      // Method 2: Use insertText command
      messageTextbox.focus();
      messageTextbox.innerHTML = '';
      await sleep(200);
      document.execCommand('insertText', false, messageContent);
      messageTextbox.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(500);
    }

    console.log('[ActionExecutor] Message typed:', messageTextbox.innerText.substring(0, 50) + '...');

    // Wait a moment for LinkedIn to enable the send button
    await sleep(1000);

    // Send the message - find and click the Send button
    console.log('[ActionExecutor] Looking for Send button...');

    // Find send button with multiple selectors
    let sendButton = document.querySelector('button.msg-form__send-button:not([disabled])') ||
                     document.querySelector('button[type="submit"].msg-form__send-button:not([disabled])') ||
                     document.querySelector('form.msg-form button[type="submit"]:not([disabled])') ||
                     document.querySelector(selectors.MESSAGE.SEND_BUTTON);

    // Wait for send button to become enabled
    let sendRetries = 0;
    while ((!sendButton || sendButton.disabled) && sendRetries < 5) {
      sendRetries++;
      console.log(`[ActionExecutor] Send button not ready, retry ${sendRetries}/5...`);
      await sleep(500);
      sendButton = document.querySelector('button.msg-form__send-button:not([disabled])') ||
                   document.querySelector('button[type="submit"].msg-form__send-button:not([disabled])');
    }

    if (sendButton && !sendButton.disabled) {
      console.log('[ActionExecutor] Clicking Send button...');
      sendButton.click();
      await sleep(1000);
      console.log('[ActionExecutor] Message sent via Send button');
    } else {
      // Fallback: Try keyboard shortcuts
      console.log('[ActionExecutor] Send button not found/disabled, trying Ctrl+Enter...');
      messageTextbox.focus();

      const ctrlEnterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        ctrlKey: true,
        bubbles: true,
        cancelable: true
      });
      messageTextbox.dispatchEvent(ctrlEnterEvent);
      await sleep(1000);

      console.log('[ActionExecutor] Attempted to send via Ctrl+Enter');
    }

    // Close the message box
    console.log('[ActionExecutor] Closing message box...');

    // Look for button with close-small SVG icon
    const closeButtonSvg = document.querySelector(selectors.MESSAGE.CLOSE_BUTTON_SVG);
    if (closeButtonSvg) {
      // Click the button (parent of the SVG)
      closeButtonSvg.closest('button').click();
      console.log('[ActionExecutor] Message box closed');
    } else {
      // Fallback: find button with specific class
      const closeButtons = document.querySelectorAll(selectors.MESSAGE.CLOSE_BUTTON);
      for (const btn of closeButtons) {
        if (btn.textContent.includes('Close') || btn.querySelector('svg')) {
          btn.click();
          console.log('[ActionExecutor] Message box closed (fallback)');
          break;
        }
      }
    }

    await sleep(500);

    return { success: true, message: `Message sent to ${action.prospect.full_name}` };

  } catch (error) {
    console.error('[ActionExecutor] Message failed:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Execute an EMAIL action
 * Visits profile and extracts email from Contact Info overlay
 * @param {object} action - Action data from API
 * @returns {Promise<{success: boolean, message: string, email?: string}>}
 */
async function executeEmail(action) {
  console.log('[ActionExecutor] Executing EMAIL action for:', action.prospect.full_name);

  const selectors = window.LINKEDIN_SELECTORS;
  if (!selectors) {
    return { success: false, message: 'Selectors not loaded' };
  }

  try {
    const profileUrl = action.prospect.profile_url;
    const linkedinId = action.prospect.linkedin_id || extractLinkedInIdFromUrl(profileUrl);

    // Check if we're already on this profile by comparing LinkedIn ID
    const currentUrl = window.location.href;
    const isOnProfile = currentUrl.includes('/in/') &&
                        (currentUrl.includes(linkedinId) || currentUrl.includes(profileUrl.replace('https://www.linkedin.com', '')));

    console.log(`[ActionExecutor] Email action - LinkedIn ID: ${linkedinId}, Current URL: ${currentUrl}, On profile: ${isOnProfile}`);

    // Navigate to profile if not already there
    if (!isOnProfile) {
      console.log('[ActionExecutor] Navigating to profile for email extraction:', profileUrl);
      window.location.href = profileUrl;
      return { success: true, message: 'Navigating to profile', navigating: true };
    }

    console.log('[ActionExecutor] Already on profile, proceeding with email extraction...');

    // Wait for page to fully load
    await sleep(3000);

    // Find the Contact Info link (retry a few times)
    let contactInfoLink = null;
    for (let i = 0; i < 3; i++) {
      contactInfoLink = document.querySelector(selectors.CONTACT_INFO.OPENER);
      if (contactInfoLink) break;
      console.log(`[ActionExecutor] Contact Info link not found, retry ${i + 1}/3...`);
      await sleep(1500);
    }

    if (!contactInfoLink) {
      console.log('[ActionExecutor] Contact Info link not found after retries');
      return { success: true, message: 'Contact Info not available', email: null };
    }

    console.log('[ActionExecutor] Opening Contact Info overlay...');
    contactInfoLink.click();

    // Wait for modal to appear with retries (increased timeout)
    let modal = null;
    for (let i = 0; i < 8; i++) {
      await sleep(1500);
      modal = document.querySelector(selectors.CONTACT_INFO.MODAL) ||
              document.querySelector('.artdeco-modal__content') ||
              document.querySelector('.artdeco-modal') ||
              document.querySelector('[data-test-modal]') ||
              document.querySelector('div[role="dialog"]');
      if (modal) {
        console.log('[ActionExecutor] Contact Info modal appeared');
        break;
      }
      console.log(`[ActionExecutor] Waiting for modal to appear... (${i + 1}/8)`);
    }

    if (!modal) {
      console.log('[ActionExecutor] Contact Info modal did not appear after waiting');
      return { success: true, message: 'Contact Info modal did not open', email: null };
    }

    // Extra wait for modal content to fully load
    console.log('[ActionExecutor] Waiting for modal content to load...');
    await sleep(3000);

    // Try to find email in the modal with retries
    let emailLink = null;
    for (let i = 0; i < 5; i++) {
      // Try multiple selectors
      emailLink = modal.querySelector(selectors.CONTACT_INFO.EMAIL_LINK) ||
                  modal.querySelector(selectors.CONTACT_INFO.EMAIL_LINK_ALT) ||
                  modal.querySelector('a[href^="mailto:"]') ||
                  document.querySelector('.artdeco-modal a[href^="mailto:"]') ||
                  document.querySelector('div[role="dialog"] a[href^="mailto:"]');

      if (emailLink) {
        console.log('[ActionExecutor] Email link found in modal');
        break;
      }

      console.log(`[ActionExecutor] Email link not found yet, retry ${i + 1}/5...`);
      await sleep(1000);
    }

    let email = null;
    if (emailLink) {
      // Extract email from href="mailto:email@example.com"
      const href = emailLink.getAttribute('href');
      email = href.replace('mailto:', '').trim();
      console.log('[ActionExecutor] Email found:', email);

      // Save email to backend
      try {
        const linkedinId = action.prospect.linkedin_id;
        if (linkedinId && email) {
          // Send message to background to update prospect email
          await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
              type: 'API_REQUEST',
              endpoint: `/extension/prospects/${linkedinId}/email`,
              method: 'PATCH',
              body: { email }
            }, (response) => {
              if (chrome.runtime.lastError) {
                console.error('[ActionExecutor] Failed to save email:', chrome.runtime.lastError);
                reject(chrome.runtime.lastError);
              } else if (response && response.error) {
                console.error('[ActionExecutor] API error saving email:', response.error);
                reject(new Error(response.error));
              } else {
                console.log('[ActionExecutor] Email saved to backend');
                resolve(response);
              }
            });
          });
        }
      } catch (saveError) {
        console.error('[ActionExecutor] Error saving email:', saveError);
        // Continue even if save failed
      }
    } else {
      console.log('[ActionExecutor] No email found in Contact Info');
    }

    // Close the Contact Info modal
    const closeButton = modal.querySelector(selectors.CONTACT_INFO.CLOSE_BUTTON) ||
                        document.querySelector('button[aria-label="Dismiss"]');
    if (closeButton) {
      closeButton.click();
      await sleep(300);
      console.log('[ActionExecutor] Contact Info modal closed');
    }

    if (email) {
      return { success: true, message: `Email extracted: ${email}`, email };
    } else {
      return { success: true, message: 'No email found for this user', email: null };
    }

  } catch (error) {
    console.error('[ActionExecutor] Extract email failed:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Execute SMART_CONNECT action - conditional logic based on connection status
 * If already connected: send message
 * If not connected: send connection request
 *
 * @param {object} action - Action data from API with connected_message and invite_message
 * @returns {Promise<{success: boolean, message: string, navigating?: boolean, executed_action?: string}>}
 */
async function executeSmartConnect(action) {
  console.log('[ActionExecutor] Executing SMART_CONNECT action for:', action.prospect.full_name);

  const selectors = window.LINKEDIN_SELECTORS;
  if (!selectors) {
    return { success: false, message: 'Selectors not loaded' };
  }

  try {
    const profileUrl = action.prospect.profile_url;

    // Navigate to profile if not already there
    if (!window.location.href.includes(profileUrl.replace('https://www.linkedin.com', ''))) {
      console.log('[ActionExecutor] Navigating to profile for connect_message:', profileUrl);
      window.location.href = profileUrl;
      return { success: true, message: 'Navigating to profile', navigating: true };
    }

    // Wait for page to load
    await sleep(3000);

    // Get main profile action container with retries
    let actionContainer = null;
    let retryCount = 0;
    const maxRetries = 5;

    while (!actionContainer && retryCount < maxRetries) {
      actionContainer = getMainProfileActionContainer();
      if (!actionContainer) {
        retryCount++;
        console.log(`[ActionExecutor] Action container not found, retry ${retryCount}/${maxRetries}...`);
        await sleep(1500);
      }
    }

    if (!actionContainer) {
      return { success: false, message: 'Could not find profile action buttons after retries' };
    }

    // Wait for buttons to fully load
    await sleep(2000);

    // Check connection status by looking for Message button (only visible for 1st degree connections)
    // Retry a few times to make sure the button has loaded
    let messageButton = null;
    for (let i = 0; i < 3; i++) {
      messageButton = actionContainer.querySelector(selectors.PROFILE.MESSAGE_BUTTON);
      if (messageButton && messageButton.offsetParent !== null) {
        break;
      }
      console.log(`[ActionExecutor] Checking for Message button... (${i + 1}/3)`);
      await sleep(1000);
    }

    const isConnected = messageButton && messageButton.offsetParent !== null; // Check if visible

    console.log('[ActionExecutor] Smart Connect - Is connected:', isConnected);

    if (isConnected) {
      // User is connected - send message
      console.log('[ActionExecutor] Smart Connect: User is connected, sending message...');

      const messageContent = action.action_data?.connected_message;
      if (!messageContent || messageContent.trim() === '') {
        console.warn('[ActionExecutor] No connected_message template provided');
        return { success: true, message: 'Already connected but no message template provided', executed_action: 'none' };
      }

      // Close any existing open message boxes first
      const existingCloseButtons = document.querySelectorAll('.msg-overlay-bubble-header__control[data-control-name="overlay.close_conversation_window"], .msg-overlay-bubble-header button[aria-label="Close your conversation"], button[aria-label="Close your conversation"]');
      for (const closeBtn of existingCloseButtons) {
        try {
          closeBtn.click();
          await sleep(300);
        } catch (e) {
          // Ignore errors
        }
      }
      await sleep(500);

      // Click Message button
      messageButton.click();
      await sleep(3000);

      // Find message textbox
      const messageTextbox = document.querySelector(selectors.MESSAGE.TEXTBOX);
      if (!messageTextbox) {
        return { success: false, message: 'Message compose area did not appear' };
      }

      // Clear and type new message
      messageTextbox.focus();
      await sleep(500);
      messageTextbox.innerHTML = '<p><br></p>';
      messageTextbox.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(300);

      // Insert message with paragraph wrapper
      messageTextbox.focus();
      messageTextbox.innerHTML = `<p>${messageContent}</p>`;
      messageTextbox.dispatchEvent(new Event('input', { bubbles: true }));
      messageTextbox.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(500);

      // Fallback if innerHTML didn't work
      if (!messageTextbox.innerText.trim() || messageTextbox.innerText.trim().length < 3) {
        messageTextbox.focus();
        messageTextbox.innerHTML = '';
        document.execCommand('insertText', false, messageContent);
        messageTextbox.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(500);
      }

      console.log('[ActionExecutor] Message typed:', messageTextbox.innerText.substring(0, 30) + '...');
      await sleep(1000);

      // Find and click send button
      let sendButton = document.querySelector('button.msg-form__send-button:not([disabled])') ||
                       document.querySelector(selectors.MESSAGE.SEND_BUTTON);

      // Wait for send button to be enabled
      let sendRetries = 0;
      while ((!sendButton || sendButton.disabled) && sendRetries < 5) {
        sendRetries++;
        await sleep(500);
        sendButton = document.querySelector('button.msg-form__send-button:not([disabled])');
      }

      if (sendButton && !sendButton.disabled) {
        sendButton.click();
        await sleep(500);
      } else {
        // Fallback: Ctrl+Enter
        const ctrlEnterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          ctrlKey: true,
          bubbles: true,
          cancelable: true
        });
        messageTextbox.dispatchEvent(ctrlEnterEvent);
        await sleep(500);
      }

      console.log('[ActionExecutor] Smart Connect: Message sent successfully');
      return { success: true, message: 'Message sent (already connected)', executed_action: 'message' };

    } else {
      // User is not connected - send invite
      console.log('[ActionExecutor] Smart Connect: User is not connected, sending invite...');

      const inviteMessage = action.action_data?.invite_message;

      // Check if already pending
      const pendingButton = actionContainer.querySelector(selectors.PROFILE.PENDING_BUTTON);
      if (pendingButton) {
        console.log('[ActionExecutor] Connection request already pending');
        return { success: true, message: 'Connection request already pending', executed_action: 'none' };
      }

      // Find Connect button with retries
      let connectButton = null;
      let connectRetry = 0;
      const maxConnectRetries = 3;

      while (!connectButton && connectRetry < maxConnectRetries) {
        connectButton = actionContainer.querySelector(selectors.PROFILE.CONNECT_BUTTON);
        if (!connectButton) {
          connectRetry++;
          console.log(`[ActionExecutor] Connect button not visible, retry ${connectRetry}/${maxConnectRetries}...`);
          await sleep(1000);
        }
      }

      // If Connect not visible after retries, check More menu
      if (!connectButton) {
        let moreButton = actionContainer.querySelector(selectors.PROFILE.MORE_BUTTON);
        if (!moreButton) {
          const buttons = actionContainer.querySelectorAll('button');
          for (const btn of buttons) {
            if (btn.textContent.trim() === 'More') {
              moreButton = btn;
              break;
            }
          }
        }

        if (!moreButton) {
          return { success: false, message: 'Could not find Connect or More button' };
        }

        moreButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(500);
        moreButton.click();
        await sleep(2000);
        connectButton = document.querySelector(selectors.PROFILE.DROPDOWN_CONNECT);

        if (!connectButton) {
          return { success: false, message: 'Connect option not found in More menu' };
        }
      }

      // Click Connect button
      connectButton.click();
      await sleep(3000);

      // Check for Add note option
      const addNoteButton = document.querySelector(selectors.CONNECTION_MODAL.ADD_NOTE_BUTTON);
      const sendWithoutNoteButton = document.querySelector(selectors.CONNECTION_MODAL.SEND_WITHOUT_NOTE);

      if (!addNoteButton && !sendWithoutNoteButton) {
        const dismissButton = document.querySelector(selectors.CONNECTION_MODAL.DISMISS_BUTTON);
        if (dismissButton) dismissButton.click();
        return { success: false, message: 'LinkedIn connection limit may have been reached' };
      }

      // If we have a message, add a note
      if (inviteMessage && inviteMessage.trim() !== '' && addNoteButton) {
        addNoteButton.click();
        await sleep(2000);

        const noteTextarea = document.querySelector(selectors.CONNECTION_MODAL.NOTE_TEXTAREA);
        if (noteTextarea) {
          noteTextarea.focus();
          noteTextarea.value = inviteMessage;
          noteTextarea.dispatchEvent(new Event('input', { bubbles: true }));
          await sleep(500);
        }
      }

      // Send the request
      const sendButton = document.querySelector(selectors.CONNECTION_MODAL.SEND_BUTTON);
      if (sendButton && !sendButton.disabled) {
        sendButton.click();
        await sleep(1000);
        console.log('[ActionExecutor] Smart Connect: Connection request sent with note');
        return { success: true, message: 'Connection request sent', executed_action: 'invite' };
      } else if (sendWithoutNoteButton) {
        sendWithoutNoteButton.click();
        await sleep(1000);
        console.log('[ActionExecutor] Smart Connect: Connection request sent without note');
        return { success: true, message: 'Connection request sent (no note)', executed_action: 'invite' };
      }

      return { success: false, message: 'Could not find send button' };
    }

  } catch (error) {
    console.error('[ActionExecutor] Smart Connect failed:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Execute WARM_CONNECT action - combo: Visit → Follow → Connect
 * Warms up the prospect before sending connection request
 *
 * @param {object} action - Action data from API
 * @returns {Promise<{success: boolean, message: string, navigating?: boolean}>}
 */
async function executeWarmConnect(action) {
  console.log('[ActionExecutor] Executing WARM_CONNECT action for:', action.prospect.full_name);

  const selectors = window.LINKEDIN_SELECTORS;
  if (!selectors) {
    return { success: false, message: 'Selectors not loaded' };
  }

  try {
    const profileUrl = action.prospect.profile_url;
    const linkedinId = action.prospect.linkedin_id || extractLinkedInIdFromUrl(profileUrl);

    // Check if we're already on this profile by comparing LinkedIn ID
    const currentUrl = window.location.href;
    const isOnProfile = currentUrl.includes('/in/') &&
                        (currentUrl.includes(linkedinId) || currentUrl.includes(profileUrl.replace('https://www.linkedin.com', '')));

    console.log(`[ActionExecutor] WarmConnect - LinkedIn ID: ${linkedinId}, On profile: ${isOnProfile}`);

    // Navigate to profile if not already there
    if (!isOnProfile) {
      console.log('[ActionExecutor] Navigating to profile for visit_follow_connect:', profileUrl);
      window.location.href = profileUrl;
      return { success: true, message: 'Navigating to profile', navigating: true };
    }

    console.log('[ActionExecutor] Already on profile, proceeding with warm connect...');

    // Wait for page to load
    await sleep(3000);

    // Get main profile action container with retries
    let actionContainer = null;
    let retryCount = 0;
    const maxRetries = 5;

    while (!actionContainer && retryCount < maxRetries) {
      actionContainer = getMainProfileActionContainer();
      if (!actionContainer) {
        retryCount++;
        console.log(`[ActionExecutor] Action container not found, retry ${retryCount}/${maxRetries}...`);
        await sleep(1500);
      }
    }

    if (!actionContainer) {
      return { success: false, message: 'Could not find profile action buttons after retries' };
    }

    // Wait for all buttons to fully load
    await sleep(2000);

    // Step 1: Visit (just being on the page counts)
    console.log('[ActionExecutor] Warm Connect Step 1: Visiting profile...');
    await sleep(getRandomDelay(2000, 4000));

    // Step 2: Follow
    console.log('[ActionExecutor] Warm Connect Step 2: Following profile...');

    // Try to find follow button with retries
    let followButton = null;
    for (let i = 0; i < 3; i++) {
      followButton = actionContainer.querySelector(selectors.PROFILE.FOLLOW_BUTTON);
      if (followButton) break;
      console.log(`[ActionExecutor] Follow button not found, retry ${i + 1}/3...`);
      await sleep(1000);
    }

    if (followButton && !followButton.textContent.includes('Following')) {
      followButton.click();
      await sleep(1500);
      console.log('[ActionExecutor] Followed profile');
    } else {
      console.log('[ActionExecutor] Already following or follow button not found');
    }

    await sleep(getRandomDelay(1000, 2000));

    // Step 3: Connect
    console.log('[ActionExecutor] Warm Connect Step 3: Sending connection request...');

    // Check if already pending
    const pendingButton = actionContainer.querySelector(selectors.PROFILE.PENDING_BUTTON);
    if (pendingButton) {
      return { success: true, message: 'Visited, followed. Connection already pending.' };
    }

    // Check if already connected (retry a few times to make sure buttons are loaded)
    let messageButton = null;
    for (let i = 0; i < 3; i++) {
      messageButton = actionContainer.querySelector(selectors.PROFILE.MESSAGE_BUTTON);
      if (messageButton && messageButton.offsetParent !== null) {
        break;
      }
      await sleep(1000);
    }

    if (messageButton && messageButton.offsetParent !== null) {
      return { success: true, message: 'Visited, followed. Already connected.' };
    }

    // Find Connect button with retries
    let connectButton = null;
    let connectRetry = 0;
    const maxConnectRetries = 3;

    while (!connectButton && connectRetry < maxConnectRetries) {
      connectButton = actionContainer.querySelector(selectors.PROFILE.CONNECT_BUTTON);
      if (!connectButton) {
        connectRetry++;
        console.log(`[ActionExecutor] Connect button not visible, retry ${connectRetry}/${maxConnectRetries}...`);
        await sleep(1000);
      }
    }

    if (!connectButton) {
      // Try More menu
      let moreButton = actionContainer.querySelector(selectors.PROFILE.MORE_BUTTON);
      if (!moreButton) {
        const buttons = actionContainer.querySelectorAll('button');
        for (const btn of buttons) {
          if (btn.textContent.trim() === 'More') {
            moreButton = btn;
            break;
          }
        }
      }

      if (moreButton) {
        moreButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(500);
        moreButton.click();
        await sleep(2000);
        connectButton = document.querySelector(selectors.PROFILE.DROPDOWN_CONNECT);
      }
    }

    if (!connectButton) {
      return { success: true, message: 'Visited and followed. Connect button not available.' };
    }

    // Click Connect button
    connectButton.click();
    await sleep(3000);

    // Handle connection modal
    const addNoteButton = document.querySelector(selectors.CONNECTION_MODAL.ADD_NOTE_BUTTON);
    const sendWithoutNoteButton = document.querySelector(selectors.CONNECTION_MODAL.SEND_WITHOUT_NOTE);

    if (!addNoteButton && !sendWithoutNoteButton) {
      const dismissButton = document.querySelector(selectors.CONNECTION_MODAL.DISMISS_BUTTON);
      if (dismissButton) dismissButton.click();
      return { success: false, message: 'LinkedIn connection limit may have been reached' };
    }

    const inviteMessage = action.action_data?.invite_message;

    if (inviteMessage && inviteMessage.trim() !== '' && addNoteButton) {
      addNoteButton.click();
      await sleep(2000);

      const noteTextarea = document.querySelector(selectors.CONNECTION_MODAL.NOTE_TEXTAREA);
      if (noteTextarea) {
        noteTextarea.focus();
        noteTextarea.value = inviteMessage;
        noteTextarea.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(500);
      }
    }

    const sendButton = document.querySelector(selectors.CONNECTION_MODAL.SEND_BUTTON);
    if (sendButton && !sendButton.disabled) {
      sendButton.click();
      await sleep(1000);
      return { success: true, message: 'Visited, followed, and connection request sent!' };
    } else if (sendWithoutNoteButton) {
      sendWithoutNoteButton.click();
      await sleep(1000);
      return { success: true, message: 'Visited, followed, and connection request sent (no note)' };
    }

    return { success: false, message: 'Could not complete connection request' };

  } catch (error) {
    console.error('[ActionExecutor] Warm Connect failed:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Execute SMART_EMAIL action - Email if available, extract if not, message as fallback
 *
 * @param {object} action - Action data from API
 * @returns {Promise<{success: boolean, message: string, executed_action?: string}>}
 */
async function executeSmartEmail(action) {
  console.log('[ActionExecutor] Executing SMART_EMAIL action for:', action.prospect.full_name);

  const selectors = window.LINKEDIN_SELECTORS;
  if (!selectors) {
    return { success: false, message: 'Selectors not loaded' };
  }

  try {
    const profileUrl = action.prospect.profile_url;
    const prospectEmail = action.action_data?.prospect_email;

    // Navigate to profile if not already there
    if (!window.location.href.includes(profileUrl.replace('https://www.linkedin.com', ''))) {
      console.log('[ActionExecutor] Navigating to profile for email_message:', profileUrl);
      window.location.href = profileUrl;
      return { success: true, message: 'Navigating to profile', navigating: true };
    }

    await sleep(2000);

    // Check if we already have the prospect's email
    if (prospectEmail && prospectEmail.includes('@')) {
      console.log('[ActionExecutor] Smart Email: Prospect has email, sending email...');

      // TODO: Integrate with email sending service
      // For now, report success with the email to send
      return {
        success: true,
        message: `Email ready to send to ${prospectEmail}`,
        executed_action: 'email',
        email: prospectEmail,
        subject: action.action_data?.email_subject,
        body: action.action_data?.email_body
      };
    }

    // No email - try to extract from LinkedIn profile
    console.log('[ActionExecutor] Smart Email: No email, attempting to extract...');

    // Click Contact Info
    const contactInfoLink = document.querySelector(selectors.PROFILE.CONTACT_INFO_LINK);
    if (!contactInfoLink) {
      console.log('[ActionExecutor] Contact info link not found, falling back to message');
      return await sendFallbackMessage(action);
    }

    contactInfoLink.click();
    await sleep(2000);

    // Look for email in Contact Info modal
    const emailSection = document.querySelector(selectors.CONTACT_INFO.EMAIL_SECTION);
    let extractedEmail = null;

    if (emailSection) {
      const emailLink = emailSection.querySelector('a[href^="mailto:"]');
      if (emailLink) {
        extractedEmail = emailLink.href.replace('mailto:', '').trim();
      }
    }

    // Close the modal
    const closeButton = document.querySelector(selectors.CONTACT_INFO.CLOSE_BUTTON);
    if (closeButton) {
      closeButton.click();
      await sleep(500);
    }

    if (extractedEmail && extractedEmail.includes('@')) {
      console.log('[ActionExecutor] Smart Email: Extracted email:', extractedEmail);

      // Report email found - backend should update prospect and send email
      return {
        success: true,
        message: `Extracted email: ${extractedEmail}`,
        executed_action: 'extract_email',
        email: extractedEmail,
        subject: action.action_data?.email_subject,
        body: action.action_data?.email_body
      };
    }

    // No email found - fall back to LinkedIn message
    console.log('[ActionExecutor] Smart Email: No email found, falling back to LinkedIn message');
    return await sendFallbackMessage(action);

  } catch (error) {
    console.error('[ActionExecutor] Smart Email failed:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Helper: Send fallback LinkedIn message for email_message
 */
async function sendFallbackMessage(action) {
  const selectors = window.LINKEDIN_SELECTORS;
  const fallbackMessage = action.action_data?.fallback_message;

  if (!fallbackMessage) {
    return { success: true, message: 'No email found and no fallback message configured', executed_action: 'none' };
  }

  // Get main profile action container
  const actionContainer = getMainProfileActionContainer();
  if (!actionContainer) {
    return { success: false, message: 'Could not find profile action buttons' };
  }

  // Check if connected (Message button visible)
  const messageButton = actionContainer.querySelector(selectors.PROFILE.MESSAGE_BUTTON);
  if (!messageButton || messageButton.offsetParent === null) {
    return { success: true, message: 'No email found. Not connected, cannot send message.', executed_action: 'none' };
  }

  // Close any existing open message boxes first
  const existingCloseButtons = document.querySelectorAll('.msg-overlay-bubble-header__control[data-control-name="overlay.close_conversation_window"], .msg-overlay-bubble-header button[aria-label="Close your conversation"], button[aria-label="Close your conversation"]');
  for (const closeBtn of existingCloseButtons) {
    try {
      closeBtn.click();
      await sleep(300);
    } catch (e) {
      // Ignore errors
    }
  }
  await sleep(500);

  // Send message
  messageButton.click();
  await sleep(3000);

  const messageTextbox = document.querySelector(selectors.MESSAGE.TEXTBOX);
  if (!messageTextbox) {
    return { success: false, message: 'Message compose area did not appear' };
  }

  // Clear and type new message
  messageTextbox.focus();
  await sleep(500);
  messageTextbox.innerHTML = '<p><br></p>';
  messageTextbox.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(300);

  // Insert message with paragraph wrapper
  messageTextbox.focus();
  messageTextbox.innerHTML = `<p>${fallbackMessage}</p>`;
  messageTextbox.dispatchEvent(new Event('input', { bubbles: true }));
  messageTextbox.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(500);

  // Fallback if innerHTML didn't work
  if (!messageTextbox.innerText.trim() || messageTextbox.innerText.trim().length < 3) {
    messageTextbox.focus();
    messageTextbox.innerHTML = '';
    document.execCommand('insertText', false, fallbackMessage);
    messageTextbox.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(500);
  }

  console.log('[ActionExecutor] Fallback message typed');
  await sleep(1000);

  // Find and click send button
  let sendButton = document.querySelector('button.msg-form__send-button:not([disabled])') ||
                   document.querySelector(selectors.MESSAGE.SEND_BUTTON);

  // Wait for send button to be enabled
  let sendRetries = 0;
  while ((!sendButton || sendButton.disabled) && sendRetries < 5) {
    sendRetries++;
    await sleep(500);
    sendButton = document.querySelector('button.msg-form__send-button:not([disabled])');
  }

  if (sendButton && !sendButton.disabled) {
    sendButton.click();
    await sleep(500);
  } else {
    // Fallback: Ctrl+Enter
    const ctrlEnterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    });
    messageTextbox.dispatchEvent(ctrlEnterEvent);
    await sleep(500);
  }

  return { success: true, message: 'No email found, sent LinkedIn message instead', executed_action: 'message' };
}

/**
 * Main action executor - routes to appropriate handler
 * @param {object} action - Action data from API
 * @returns {Promise<{success: boolean, message: string, navigating?: boolean}>}
 */
async function executeAction(action) {
  console.log('[ActionExecutor] Executing action:', action.action_type);

  switch (action.action_type) {
    case 'visit':
      return await executeVisit(action);

    case 'invite':
      return await executeInvite(action);

    case 'message':
      return await executeMessage(action);

    case 'follow':
      return await executeFollow(action);

    case 'email':
      return await executeEmail(action);

    case 'connect_message':
      return await executeSmartConnect(action);

    case 'visit_follow_connect':
      return await executeWarmConnect(action);

    case 'email_message':
      return await executeSmartEmail(action);

    default:
      return {
        success: false,
        message: `Unknown action type: ${action.action_type}`
      };
  }
}

// Export functions for use in content script
if (typeof window !== 'undefined') {
  window.ActionExecutor = {
    executeAction,
    executeVisit,
    executeInvite,
    executeMessage,
    executeFollow,
    executeEmail,
    executeSmartConnect,
    executeWarmConnect,
    executeSmartEmail,
    getCurrentUserProfileUrl,
    isProfilePage,
    getMainProfileActionContainer,
    sleep,
    getRandomDelay
  };
}
