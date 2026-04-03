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
 * Find a clickable element (button or link) by its visible text content.
 * LinkedIn 2025 removed aria-label and uses <span>Text</span> inside buttons/links.
 * @param {string} text - Exact visible text to match
 * @param {Element} [scope=document] - Element to search within
 * @returns {Element|null}
 */
function findActionByText(text, scope = document) {
  // Check buttons and links
  for (const el of scope.querySelectorAll('button, a[role="button"], a[href]')) {
    const elText = el.textContent.trim();
    if (elText === text) return el;
  }
  return null;
}

/**
 * Find a clickable element by partial text match.
 * @param {string} partialText - Text to search for (case-insensitive)
 * @param {Element} [scope=document] - Element to search within
 * @returns {Element|null}
 */
function findActionByPartialText(partialText, scope = document) {
  const lower = partialText.toLowerCase();
  for (const el of scope.querySelectorAll('button, a[role="button"], a[href]')) {
    if (el.textContent.trim().toLowerCase().includes(lower)) return el;
  }
  return null;
}

/**
 * Find a menu item in the "More" dropdown by text.
 * LinkedIn 2025: dropdown is [role="menu"], items are [role="menuitem"].
 * The dropdown appears as a popover attached to body.
 * @param {string} text - Exact text to match (e.g., "Connect", "Follow")
 * @returns {Element|null}
 */
function findDropdownMenuItem(text) {
  const menus = document.querySelectorAll('[role="menu"]');
  for (const menu of menus) {
    for (const item of menu.querySelectorAll('[role="menuitem"]')) {
      // Check direct text content and also nested <p> text
      const itemText = item.textContent.trim();
      if (itemText.includes(text)) {
        // Verify it's specifically the right item (not "Report / Block" matching "Block")
        const p = item.querySelector('p');
        if (p && p.textContent.trim() === text) return item;
        // Fallback: if no <p>, check aria-label
        const ariaLabel = item.getAttribute('aria-label') || '';
        const innerLabel = item.querySelector('[aria-label]')?.getAttribute('aria-label') || '';
        if (ariaLabel.includes(text) || innerLabel.includes(text)) return item;
      }
    }
  }
  return null;
}

/**
 * Click the "More" button in the profile action area and wait for dropdown.
 * @param {Element} actionContainer
 * @returns {Promise<boolean>} true if dropdown appeared
 */
async function clickMoreAndWaitForDropdown(actionContainer) {
  let moreButton = findActionByText('More', actionContainer);
  if (!moreButton) {
    console.log('[ActionExecutor] More button not found in action container');
    return false;
  }

  console.log('[ActionExecutor] Clicking More button...');
  moreButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await sleep(500);
  moreButton.click();
  await sleep(2000);

  // Verify dropdown appeared
  const menu = document.querySelector('[role="menu"]');
  if (!menu) {
    console.log('[ActionExecutor] Dropdown did not appear, retrying...');
    moreButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await sleep(2000);
  }

  return !!document.querySelector('[role="menu"]');
}

/**
 * Get the MAIN profile action container.
 *
 * LinkedIn 2025: no class names, no aria-labels on action buttons.
 * Strategy: find "Message" or "More" by text, then walk up to find a
 * container that holds multiple action buttons/links.
 *
 * @returns {Element|null}
 */
function getMainProfileActionContainer() {
  // Find the "Message" link/button or "More" button by visible text
  const messageEl = findActionByText('Message') || findActionByText('Connect') || findActionByText('Follow');

  if (messageEl) {
    // Walk up to find the container that also has "More" or other action buttons
    let parent = messageEl.parentElement;
    let attempts = 0;
    while (parent && attempts < 10) {
      const actions = parent.querySelectorAll('button, a[href*="messaging"]');
      // A good container has at least 2 action elements
      if (actions.length >= 2) {
        console.log('[ActionExecutor] Found action container via text-based search');
        return parent;
      }
      parent = parent.parentElement;
      attempts++;
    }

    // Fallback: return closest meaningful div
    const container = messageEl.closest('div');
    if (container) {
      console.log('[ActionExecutor] Found action container (closest div fallback)');
      return container;
    }
  }

  // Legacy selectors (older LinkedIn)
  const selectors = window.LINKEDIN_SELECTORS;
  if (selectors) {
    const containers = document.querySelectorAll(selectors.PROFILE.ACTION_CONTAINER);
    for (const container of containers) {
      if (container.querySelector('button')) return container;
    }
  }

  console.warn('[ActionExecutor] Could not find profile action container');
  return null;
}

/**
 * Get current user's LinkedIn profile URL from the page
 * IMPORTANT: Must only return the LOGGED-IN user's profile, not the profile being viewed
 * @returns {Promise<string|null>}
 */
async function getCurrentUserProfileUrl() {
  console.log('[ActionExecutor] Getting current user profile URL...');

  // Method 1 (LinkedIn 2025): On the feed page, the first a[href*="/in/"] that
  // is NOT inside nav/header is the logged-in user's profile card in the left sidebar.
  // The link contains the user's name and headline.
  const allProfileLinks = document.querySelectorAll('a[href*="/in/"]');
  for (const link of allProfileLinks) {
    // Skip links inside the global nav bar (other people's profiles in notifications etc.)
    if (link.closest('nav') || link.closest('header')) continue;
    if (link.href && link.href.includes('/in/')) {
      console.log('[ActionExecutor] Found profile URL from feed page link:', link.href);
      return link.href;
    }
  }

  // Method 2: Legacy selectors (older LinkedIn UI)
  const legacySelectors = [
    '.profile-card a[href*="/in/"]',
    '.feed-identity-module a[href*="/in/"]',
    '.global-nav__me-content a[href*="/in/"]'
  ];

  for (const selector of legacySelectors) {
    const link = document.querySelector(selector);
    if (link && link.href && link.href.includes('/in/')) {
      console.log('[ActionExecutor] Found profile URL from legacy selector:', link.href);
      return link.href;
    }
  }

  // Method 3: Check stored profile URL from chrome.storage
  try {
    const stored = await chrome.storage.local.get('user_profile_url');
    if (stored.user_profile_url) {
      console.log('[ActionExecutor] Found profile URL from storage:', stored.user_profile_url);
      return stored.user_profile_url;
    }
  } catch (e) { /* ignore */ }

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
    const pendingButton = findActionByText('Pending', actionContainer) ||
                          actionContainer.querySelector(selectors.PROFILE.PENDING_BUTTON);
    if (pendingButton) {
      console.log('[ActionExecutor] Connection request already pending');
      return { success: true, message: 'Connection request already pending' };
    }

    // LinkedIn 2025: Either "Connect" or "Follow" is the primary button.
    // If Connect is not visible, it's inside the "More" dropdown.
    let connectButton = findActionByText('Connect', actionContainer);

    if (connectButton) {
      console.log('[ActionExecutor] Found Connect as primary button');
    } else {
      // Connect not visible — it's in the More dropdown
      console.log('[ActionExecutor] Connect not visible, checking More dropdown...');
      const dropdownOpened = await clickMoreAndWaitForDropdown(actionContainer);
      if (!dropdownOpened) {
        return { success: false, message: 'Could not open More dropdown' };
      }

      connectButton = findDropdownMenuItem('Connect');
      if (!connectButton) {
        // Close dropdown
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await sleep(300);
        return { success: false, message: 'Connect option not found in More menu' };
      }
      console.log('[ActionExecutor] Found Connect in More dropdown');
    }

    await sleep(300);

    // Click Connect button
    console.log('[ActionExecutor] Clicking Connect button...');
    connectButton.click();

    // Wait for modal to appear
    console.log('[ActionExecutor] Waiting for connection modal...');
    await sleep(3000);

    // Check for Add note and Send without note buttons (text-based + legacy aria-label)
    const addNoteButton = findActionByText('Add a note') ||
                          document.querySelector(selectors.CONNECTION_MODAL.ADD_NOTE_BUTTON);
    const sendWithoutNoteButton = findActionByText('Send without a note') ||
                                  findActionByText('Send') ||
                                  document.querySelector(selectors.CONNECTION_MODAL.SEND_WITHOUT_NOTE);

    // Check for premium upsell / limit reached — LinkedIn shows this when
    // non-premium users exceed 3 personalized invites per month
    const modalContent = document.querySelector('.artdeco-modal__content') ||
                         document.querySelector('[role="dialog"]');
    const modalText = modalContent?.textContent || '';
    const isPremiumUpsell = modalText.includes('Premium') && (
      modalText.includes('Reactivate') || modalText.includes('upgrade') ||
      modalText.includes('Upgrade') || modalText.includes('Subscribe') ||
      modalText.includes('personalized invite')
    );

    if (isPremiumUpsell && !addNoteButton && !sendWithoutNoteButton) {
      console.warn('[ActionExecutor] LinkedIn premium limit reached — pausing campaign');
      const dismissButton = findActionByText('Dismiss') || findActionByText('Got it') ||
                            findActionByText('Not now') ||
                            document.querySelector('button[aria-label="Dismiss"]');
      if (dismissButton) { dismissButton.click(); await sleep(500); }
      return { success: false, message: 'PREMIUM_LIMIT_REACHED', pauseCampaign: true };
    }

    // If neither button exists, LinkedIn limit may have been reached
    if (!addNoteButton && !sendWithoutNoteButton) {
      console.warn('[ActionExecutor] LinkedIn connection limit may have been reached');
      const dismissButton = findActionByText('Dismiss') || findActionByText('Got it') ||
                            document.querySelector('button[aria-label="Dismiss"]');
      if (dismissButton) { dismissButton.click(); await sleep(500); }
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

      // Focus and set value — must trigger multiple events for LinkedIn's
      // ember framework to recognize the change and enable the Send button
      noteTextarea.focus();
      noteTextarea.click();
      await sleep(300);

      // Clear existing content and set new value
      noteTextarea.value = '';
      noteTextarea.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(100);

      // Set the message using native setter to bypass framework wrappers
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
      ).set;
      nativeSetter.call(noteTextarea, message);

      // Fire all relevant events so LinkedIn's UI updates (enables Send button)
      noteTextarea.dispatchEvent(new Event('input', { bubbles: true }));
      noteTextarea.dispatchEvent(new Event('change', { bubbles: true }));
      noteTextarea.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
      await sleep(500);

      console.log('[ActionExecutor] Message entered successfully');

      // Click Send invitation button
      console.log('[ActionExecutor] Looking for Send button...');
      await sleep(500);

      const sendButton = findActionByText('Send invitation') ||
                         findActionByText('Send') ||
                         document.querySelector(selectors.CONNECTION_MODAL.SEND_BUTTON);
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

    // Check if already following
    const alreadyFollowing = findActionByText('Following', actionContainer) ||
                             actionContainer.querySelector('button[aria-label*="Following"]');
    if (alreadyFollowing) {
      console.log('[ActionExecutor] Already following this person');
      return { success: true, message: 'Already following this person' };
    }

    // LinkedIn 2025: Either "Follow" or "Connect" is the primary button.
    // If Follow is not visible, it's inside the "More" dropdown.
    let followButton = findActionByText('Follow', actionContainer);

    if (followButton) {
      console.log('[ActionExecutor] Found Follow as primary button, clicking...');
      followButton.click();
      await sleep(1000);
      return { success: true, message: `Now following ${action.prospect.full_name}` };
    }

    // Follow not visible — it's in the More dropdown
    console.log('[ActionExecutor] Follow not visible, checking More dropdown...');
    const dropdownOpened = await clickMoreAndWaitForDropdown(actionContainer);
    if (!dropdownOpened) {
      return { success: false, message: 'Could not open More dropdown' };
    }

    followButton = findDropdownMenuItem('Follow');
    if (!followButton) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await sleep(300);
      return { success: false, message: 'Follow option not found in More menu' };
    }

    console.log('[ActionExecutor] Found Follow in More dropdown, clicking...');
    await sleep(300);
    followButton.click();
    await sleep(1000);

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

    // Find Message button/link in main profile area with retries
    // LinkedIn 2025: Message is an <a> tag, not a <button>
    let messageButton = null;
    let msgRetry = 0;
    const maxMsgRetries = 5;

    while (!messageButton && msgRetry < maxMsgRetries) {
      messageButton = findActionByText('Message', actionContainer) ||
                      actionContainer.querySelector(selectors.PROFILE.MESSAGE_BUTTON);
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
    let messageTextbox = document.querySelector(selectors.MESSAGE.TEXTBOX) ||
                         document.querySelector('.msg-form__contenteditable[contenteditable="true"]') ||
                         document.querySelector('[contenteditable="true"][role="textbox"]');
    if (!messageTextbox) {
      // Retry a few times — the compose area may take a moment to appear
      for (let i = 0; i < 5; i++) {
        await sleep(1000);
        messageTextbox = document.querySelector(selectors.MESSAGE.TEXTBOX) ||
                         document.querySelector('.msg-form__contenteditable[contenteditable="true"]') ||
                         document.querySelector('[contenteditable="true"][role="textbox"]');
        if (messageTextbox) break;
      }
    }
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

    // Find send button — try text-based, then class-based, then form submit
    let sendButton = document.querySelector('button[class*="msg-form__send"]:not([disabled])') ||
                     document.querySelector('form.msg-form button[type="submit"]:not([disabled])') ||
                     document.querySelector(selectors.MESSAGE.SEND_BUTTON);

    // Wait for send button to become enabled
    let sendRetries = 0;
    while ((!sendButton || sendButton.disabled) && sendRetries < 5) {
      sendRetries++;
      console.log(`[ActionExecutor] Send button not ready, retry ${sendRetries}/5...`);
      await sleep(500);
      sendButton = document.querySelector('button[class*="msg-form__send"]:not([disabled])') ||
                   document.querySelector('form.msg-form button[type="submit"]:not([disabled])');
    }

    // Fallback: find by aria-label or text
    if (!sendButton || sendButton.disabled) {
      sendButton = document.querySelector('button[aria-label="Send"]') ||
                   document.querySelector('button[type="submit"][aria-label*="Send"]');
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

    // Check connection status by looking for Message button (visible for 1st degree connections)
    let messageButton = findActionByText('Message', actionContainer);
    const isConnected = !!messageButton;

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
      let sendButton = document.querySelector('button[class*="msg-form__send"]:not([disabled])') ||
                       document.querySelector(selectors.MESSAGE.SEND_BUTTON);

      // Wait for send button to be enabled
      let sendRetries = 0;
      while ((!sendButton || sendButton.disabled) && sendRetries < 5) {
        sendRetries++;
        await sleep(500);
        sendButton = document.querySelector('button[class*="msg-form__send"]:not([disabled])');
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
      if (findActionByText('Pending', actionContainer)) {
        return { success: true, message: 'Connection request already pending', executed_action: 'none' };
      }

      // Find Connect — primary or in More dropdown
      let connectButton = findActionByText('Connect', actionContainer);
      if (!connectButton) {
        const dropdownOpened = await clickMoreAndWaitForDropdown(actionContainer);
        if (dropdownOpened) {
          connectButton = findDropdownMenuItem('Connect');
        }
      }

      if (!connectButton) {
        return { success: false, message: 'Could not find Connect button' };
      }

      connectButton.click();
      await sleep(3000);

      // Handle connection modal
      const addNoteButton = findActionByText('Add a note') ||
                            document.querySelector(selectors.CONNECTION_MODAL.ADD_NOTE_BUTTON);
      const sendWithoutNoteButton = findActionByText('Send without a note') ||
                                    findActionByText('Send') ||
                                    document.querySelector(selectors.CONNECTION_MODAL.SEND_WITHOUT_NOTE);

      // Check premium upsell
      const modalText = (document.querySelector('.artdeco-modal__content') || document.querySelector('[role="dialog"]'))?.textContent || '';
      if (modalText.includes('Premium') && (modalText.includes('Reactivate') || modalText.includes('upgrade') || modalText.includes('Upgrade'))) {
        const dismissBtn = findActionByText('Dismiss') || findActionByText('Got it') || document.querySelector('button[aria-label="Dismiss"]');
        if (dismissBtn) dismissBtn.click();
        return { success: false, message: 'PREMIUM_LIMIT_REACHED', pauseCampaign: true };
      }

      if (!addNoteButton && !sendWithoutNoteButton) {
        const dismissButton = findActionByText('Dismiss') || document.querySelector('button[aria-label="Dismiss"]');
        if (dismissButton) dismissButton.click();
        return { success: false, message: 'LinkedIn connection limit may have been reached' };
      }

      // If we have a message, add a note
      if (inviteMessage && inviteMessage.trim() !== '' && addNoteButton) {
        addNoteButton.click();
        await sleep(2000);

        const noteTextarea = document.querySelector('textarea[name="message"]') ||
                             document.querySelector(selectors.CONNECTION_MODAL.NOTE_TEXTAREA);
        if (noteTextarea) {
          noteTextarea.focus();
          noteTextarea.click();
          await sleep(300);
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
          nativeSetter.call(noteTextarea, inviteMessage);
          noteTextarea.dispatchEvent(new Event('input', { bubbles: true }));
          noteTextarea.dispatchEvent(new Event('change', { bubbles: true }));
          noteTextarea.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
          await sleep(500);
        }

        const sendButton = findActionByText('Send invitation') || findActionByText('Send') ||
                           document.querySelector(selectors.CONNECTION_MODAL.SEND_BUTTON);
        if (sendButton && !sendButton.disabled) {
          sendButton.click();
          await sleep(1000);
          return { success: true, message: 'Connection request sent with note', executed_action: 'invite' };
        }
      }

      if (sendWithoutNoteButton) {
        sendWithoutNoteButton.click();
        await sleep(1000);
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

    // Check if already following
    const alreadyFollowing = findActionByText('Following', actionContainer);
    if (alreadyFollowing) {
      console.log('[ActionExecutor] Already following');
    } else {
      // Follow button could be primary or in More dropdown
      let followButton = findActionByText('Follow', actionContainer);
      if (followButton) {
        followButton.click();
        await sleep(1500);
        console.log('[ActionExecutor] Followed profile');
      } else {
        // Try More dropdown for Follow
        const dropdownOpened = await clickMoreAndWaitForDropdown(actionContainer);
        if (dropdownOpened) {
          const followMenuItem = findDropdownMenuItem('Follow');
          if (followMenuItem) {
            followMenuItem.click();
            await sleep(1500);
            console.log('[ActionExecutor] Followed via More dropdown');
          }
          // Close dropdown if still open
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          await sleep(300);
        }
      }
    }

    await sleep(getRandomDelay(1000, 2000));

    // Step 3: Connect
    console.log('[ActionExecutor] Warm Connect Step 3: Sending connection request...');

    // Check if already pending
    const pendingButton = findActionByText('Pending', actionContainer);
    if (pendingButton) {
      return { success: true, message: 'Visited, followed. Connection already pending.' };
    }

    // Find Connect — primary button or in More dropdown
    let connectButton = findActionByText('Connect', actionContainer);

    if (!connectButton) {
      const dropdownOpened = await clickMoreAndWaitForDropdown(actionContainer);
      if (dropdownOpened) {
        connectButton = findDropdownMenuItem('Connect');
      }
    }

    if (!connectButton) {
      return { success: true, message: 'Visited and followed. Connect button not available.' };
    }

    // Click Connect button
    connectButton.click();
    await sleep(3000);

    // Handle connection modal — detect premium upsell
    const addNoteButton = findActionByText('Add a note') ||
                          document.querySelector(selectors.CONNECTION_MODAL.ADD_NOTE_BUTTON);
    const sendWithoutNoteButton = findActionByText('Send without a note') ||
                                  findActionByText('Send') ||
                                  document.querySelector(selectors.CONNECTION_MODAL.SEND_WITHOUT_NOTE);

    // Check for premium upsell
    const modalText = (document.querySelector('.artdeco-modal__content') || document.querySelector('[role="dialog"]'))?.textContent || '';
    if (modalText.includes('Premium') && (modalText.includes('Reactivate') || modalText.includes('upgrade') || modalText.includes('Upgrade'))) {
      const dismissBtn = findActionByText('Dismiss') || findActionByText('Got it') || document.querySelector('button[aria-label="Dismiss"]');
      if (dismissBtn) dismissBtn.click();
      return { success: false, message: 'PREMIUM_LIMIT_REACHED', pauseCampaign: true };
    }

    if (!addNoteButton && !sendWithoutNoteButton) {
      const dismissButton = findActionByText('Dismiss') || document.querySelector('button[aria-label="Dismiss"]');
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
  let sendButton = document.querySelector('button[class*="msg-form__send"]:not([disabled])') ||
                   document.querySelector(selectors.MESSAGE.SEND_BUTTON);

  // Wait for send button to be enabled
  let sendRetries = 0;
  while ((!sendButton || sendButton.disabled) && sendRetries < 5) {
    sendRetries++;
    await sleep(500);
    sendButton = document.querySelector('button[class*="msg-form__send"]:not([disabled])');
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
