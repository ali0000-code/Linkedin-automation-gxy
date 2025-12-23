/**
 * Message Extractor Service
 *
 * Extracts LinkedIn conversations and messages from the messaging inbox.
 * Used for syncing LinkedIn messages to the webapp.
 */

const MessageExtractor = {
  /**
   * Helper to find element using array of selectors (tries each until one works)
   * @param {Array<string>} selectors - Array of CSS selectors to try
   * @param {Element} context - Context element to search within (default: document)
   * @returns {Element|null} First matching element or null
   */
  findElement(selectors, context = document) {
    for (const selector of selectors) {
      const element = context.querySelector(selector);
      if (element) {
        return element;
      }
    }
    return null;
  },

  /**
   * Helper to find all elements using array of selectors
   * @param {Array<string>} selectors - Array of CSS selectors to try
   * @param {Element} context - Context element to search within (default: document)
   * @returns {NodeList|Array} Matching elements or empty array
   */
  findAllElements(selectors, context = document) {
    for (const selector of selectors) {
      const elements = context.querySelectorAll(selector);
      if (elements.length > 0) {
        console.log(`[MessageExtractor] Found ${elements.length} elements with selector: ${selector}`);
        return elements;
      }
    }
    return [];
  },

  /**
   * Get messaging selectors from LINKEDIN_SELECTORS or use defaults
   */
  getSelectors() {
    if (typeof window.LINKEDIN_SELECTORS !== 'undefined' && window.LINKEDIN_SELECTORS.MESSAGING) {
      return window.LINKEDIN_SELECTORS.MESSAGING;
    }
    // Fallback defaults (based on Dec 2024 LinkedIn HTML structure)
    return {
      CONVERSATION_LIST_CONTAINERS: [
        '.msg-conversations-container__conversations-list',
        '.msg-conversations-container'
      ],
      CONVERSATION_ITEMS: [
        'li.msg-conversation-listitem',
        '.msg-conversation-listitem__link'
      ],
      CONVERSATION_LINK_DIV: [
        '.msg-conversation-listitem__link',
        '.msg-conversations-container__convo-item-link'
      ],
      PARTICIPANT_NAME: [
        'h3.msg-conversation-listitem__participant-names',
        '.msg-conversation-card__participant-names'
      ],
      AVATAR: [
        'img.presence-entity__image',
        '.presence-entity__image'
      ],
      MESSAGE_PREVIEW: [
        'p.msg-conversation-card__message-snippet',
        '.msg-conversation-card__message-snippet'
      ],
      TIMESTAMP: [
        'time.msg-conversation-listitem__time-stamp',
        'time.msg-conversation-card__time-stamp'
      ],
      UNREAD_COUNT: ['.msg-conversation-listitem__unread-count'],
      MESSAGE_ITEM: ['li.msg-s-message-list__event'],
      MESSAGE_CONTENT: ['p.msg-s-event-listitem__body'],
      MESSAGE_INPUT: ['.msg-form__contenteditable'],
      SEND_BUTTON: ['.msg-form__send-button'],
    };
  },

  /**
   * Extract conversation list from LinkedIn messaging page
   * Must be called when on linkedin.com/messaging/
   * @returns {Array} Array of conversation objects
   */
  async extractConversationList() {
    console.log('[MessageExtractor] Extracting conversation list...');
    console.log('[MessageExtractor] Current URL:', window.location.href);

    const selectors = this.getSelectors();
    const conversations = [];

    // Wait for conversation list to load - try multiple selectors
    let listContainer = null;
    for (const selector of selectors.CONVERSATION_LIST_CONTAINERS) {
      console.log(`[MessageExtractor] Trying container selector: ${selector}`);
      listContainer = await this.waitForElement(selector, 5000);
      if (listContainer) {
        console.log(`[MessageExtractor] Found container with: ${selector}`);
        break;
      }
    }

    if (!listContainer) {
      console.error('[MessageExtractor] Could not find conversation list container!');
      console.log('[MessageExtractor] Page HTML preview:', document.body.innerHTML.substring(0, 1000));
      return conversations;
    }

    // Get all conversation items
    const conversationElements = this.findAllElements(selectors.CONVERSATION_ITEMS);
    console.log(`[MessageExtractor] Found ${conversationElements.length} conversation elements`);

    for (const element of conversationElements) {
      try {
        const conversation = this.parseConversationElement(element);
        if (conversation) {
          conversations.push(conversation);
        }
      } catch (error) {
        console.error('[MessageExtractor] Error parsing conversation:', error);
      }
    }

    console.log(`[MessageExtractor] Extracted ${conversations.length} conversations`);
    return conversations;
  },

  /**
   * Parse a single conversation list item element
   * Note: LinkedIn doesn't include thread ID in list view, we extract basic info
   * and the thread ID will come from clicking and checking URL
   * @param {Element} element - The conversation list item element
   * @returns {Object|null} Conversation data or null if parsing fails
   */
  parseConversationElement(element) {
    const selectors = this.getSelectors();

    // Get participant info
    const nameElement = this.findElement(selectors.PARTICIPANT_NAME, element);
    const participantName = nameElement?.textContent?.trim() || 'Unknown';

    // Get avatar
    const avatarElement = this.findElement(selectors.AVATAR, element);
    const participantAvatarUrl = avatarElement?.getAttribute('src') || null;

    // Get last message preview
    const previewElement = this.findElement(selectors.MESSAGE_PREVIEW, element);
    const lastMessagePreview = previewElement?.textContent?.trim() || null;

    // Get timestamp
    const timeElement = this.findElement(selectors.TIMESTAMP, element);
    const lastMessageAt = this.parseRelativeTime(timeElement?.textContent?.trim());

    // Check if unread
    const isUnread = element.className?.includes('unread') ||
      element.closest('li')?.className?.includes('unread') ||
      this.findElement(selectors.UNREAD_COUNT, element) !== null;

    // Get unread count
    const unreadCountElement = this.findElement(selectors.UNREAD_COUNT, element);
    const unreadCount = unreadCountElement ? parseInt(unreadCountElement.textContent?.trim() || '0', 10) : 0;

    console.log(`[MessageExtractor] Parsed conversation element: ${participantName}`);

    return {
      element: element, // Keep reference to click on it later
      participant_name: participantName,
      participant_avatar_url: participantAvatarUrl,
      last_message_preview: lastMessagePreview,
      last_message_at: lastMessageAt,
      is_unread: isUnread,
      unread_count: unreadCount,
    };
  },

  /**
   * Extract conversations by clicking each one to get the thread ID
   * @param {number} limit - Max conversations to extract
   * @returns {Array} Array of conversation objects with thread IDs
   */
  async extractConversationsWithIds(limit = 50) {
    console.log('[MessageExtractor] Extracting conversations with IDs...');

    const selectors = this.getSelectors();
    const conversations = [];

    // Get all conversation elements
    const conversationElements = this.findAllElements(selectors.CONVERSATION_ITEMS);
    console.log(`[MessageExtractor] Found ${conversationElements.length} conversation elements`);

    const elementsToProcess = Array.from(conversationElements).slice(0, limit);

    for (let i = 0; i < elementsToProcess.length; i++) {
      const element = elementsToProcess[i];

      try {
        // Parse basic info from list view
        const basicInfo = this.parseConversationElement(element);
        if (!basicInfo) continue;

        // Click on the conversation to get thread ID
        console.log(`[MessageExtractor] Clicking conversation ${i + 1}/${elementsToProcess.length}: ${basicInfo.participant_name}`);

        // Find clickable element
        const clickable = this.findElement(selectors.CONVERSATION_LINK_DIV, element) || element;
        clickable.click();

        // Wait for URL to change
        await this.wait(800);

        // Extract thread ID from URL
        const url = window.location.href;
        const threadMatch = url.match(/\/messaging\/thread\/([^/]+)/);
        const linkedinConversationId = threadMatch ? threadMatch[1] : null;

        if (!linkedinConversationId) {
          console.log(`[MessageExtractor] Could not get thread ID for ${basicInfo.participant_name}, URL: ${url}`);
          continue;
        }

        // Try to get profile info from the conversation header
        const profileLink = document.querySelector('.msg-thread__link-to-profile, a[href*="/in/"]');
        const profileHref = profileLink?.getAttribute('href') || '';
        const linkedinIdMatch = profileHref.match(/\/in\/([^/?]+)/);

        // Build final conversation object
        const conversation = {
          linkedin_conversation_id: linkedinConversationId,
          participant_name: basicInfo.participant_name,
          participant_linkedin_id: linkedinIdMatch ? linkedinIdMatch[1] : null,
          participant_profile_url: linkedinIdMatch ? `https://www.linkedin.com/in/${linkedinIdMatch[1]}/` : null,
          participant_avatar_url: basicInfo.participant_avatar_url,
          participant_headline: null,
          last_message_preview: basicInfo.last_message_preview,
          last_message_at: basicInfo.last_message_at,
          is_unread: basicInfo.is_unread,
          unread_count: basicInfo.unread_count,
        };

        console.log(`[MessageExtractor] Extracted: ${conversation.participant_name} (${linkedinConversationId})`);
        conversations.push(conversation);

        // Small delay between conversations
        await this.wait(300);

      } catch (error) {
        console.error(`[MessageExtractor] Error processing conversation ${i}:`, error);
      }
    }

    console.log(`[MessageExtractor] Extracted ${conversations.length} conversations with IDs`);
    return conversations;
  },

  /**
   * Extract messages from an open conversation
   * Must be called when a conversation is open in the messaging view
   * @returns {Array} Array of message objects
   */
  async extractMessages() {
    console.log('[MessageExtractor] Extracting messages from conversation...');

    const messages = [];

    // Wait for messages to load
    await this.waitForElement('.msg-s-message-list__event');

    // Get all message elements
    const messageElements = document.querySelectorAll('.msg-s-message-list__event');

    for (const element of messageElements) {
      try {
        const message = this.parseMessageElement(element);
        if (message) {
          messages.push(message);
        }
      } catch (error) {
        console.error('[MessageExtractor] Error parsing message:', error);
      }
    }

    console.log(`[MessageExtractor] Extracted ${messages.length} messages`);
    return messages;
  },

  /**
   * Parse a single message element
   * @param {Element} element - The message element
   * @returns {Object|null} Message data or null if parsing fails
   */
  // Track recently sent messages to avoid duplicates
  _recentlySentMessages: new Set(),

  /**
   * Mark a message as recently sent (to avoid treating it as incoming)
   * @param {string} content - Message content
   */
  markMessageAsSent(content) {
    const key = content.trim().toLowerCase();
    this._recentlySentMessages.add(key);
    // Remove after 10 seconds
    setTimeout(() => {
      this._recentlySentMessages.delete(key);
    }, 10000);
  },

  parseMessageElement(element) {
    // Get message content
    const contentElement = element.querySelector('.msg-s-event-listitem__body');
    const content = contentElement?.textContent?.trim();

    if (!content) {
      return null;
    }

    // Get message ID from element
    const messageId = element.getAttribute('data-event-urn') ||
      element.querySelector('[data-event-urn]')?.getAttribute('data-event-urn') ||
      `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Check if message is from me - multiple detection methods
    let isFromMe = false;

    // Method 1: Check CSS classes
    if (element.classList.contains('msg-s-message-list__event--from-me') ||
        element.querySelector('.msg-s-message-group--outbound') !== null) {
      isFromMe = true;
    }

    // Method 2: Check for outbound message wrapper
    const parentGroup = element.closest('.msg-s-message-group');
    if (parentGroup?.classList.contains('msg-s-message-group--outbound')) {
      isFromMe = true;
    }

    // Method 3: Check if no sender link (outbound messages often don't have sender link)
    const senderLink = element.querySelector('a[href*="/in/"]');
    const hasNoSenderLink = !senderLink;

    // Method 4: Check if message was recently sent by us
    const contentKey = content.trim().toLowerCase();
    if (this._recentlySentMessages.has(contentKey)) {
      isFromMe = true;
      this._recentlySentMessages.delete(contentKey);
    }

    // Method 5: Check for "You" or no profile picture alignment
    const msgWrapper = element.querySelector('.msg-s-event-listitem');
    if (msgWrapper?.classList.contains('msg-s-event-listitem--outbound')) {
      isFromMe = true;
    }

    // Get sender info
    const senderElement = element.querySelector('.msg-s-message-group__profile-link, .msg-s-message-group__name');
    const senderName = senderElement?.textContent?.trim() || (isFromMe ? 'Me' : 'Unknown');

    // Get sender LinkedIn ID
    const senderHref = senderLink?.getAttribute('href') || '';
    const senderIdMatch = senderHref.match(/\/in\/([^/?]+)/);
    const senderLinkedinId = senderIdMatch ? senderIdMatch[1] : null;

    // Get timestamp
    const timeElement = element.querySelector('.msg-s-message-group__timestamp, time');
    const sentAt = timeElement?.getAttribute('datetime') ||
      this.parseRelativeTime(timeElement?.textContent?.trim());

    return {
      linkedin_message_id: messageId,
      content: content,
      is_from_me: isFromMe,
      sender_name: senderName,
      sender_linkedin_id: senderLinkedinId,
      sent_at: sentAt,
    };
  },

  /**
   * Open a conversation by ID and extract its messages
   * @param {string} conversationId - LinkedIn conversation ID
   * @returns {Array} Array of message objects
   */
  async openAndExtractMessages(conversationId) {
    console.log(`[MessageExtractor] Opening conversation ${conversationId}...`);

    // Navigate to the conversation
    const conversationUrl = `https://www.linkedin.com/messaging/thread/${conversationId}/`;

    if (window.location.href !== conversationUrl) {
      window.location.href = conversationUrl;
      await this.wait(2000); // Wait for navigation
      await this.waitForElement('.msg-s-message-list__event');
    }

    return await this.extractMessages();
  },

  /**
   * Perform full sync - extract all conversations with their messages
   * @param {boolean} includeMessages - Whether to fetch messages for each conversation
   * @param {number} limit - Maximum number of conversations to sync
   * @returns {Array} Array of conversation objects with messages
   */
  async performFullSync(includeMessages = false, limit = 50) {
    console.log('[MessageExtractor] Starting full sync...');
    console.log('[MessageExtractor] Current URL:', window.location.href);

    // Make sure we're on the messaging page
    if (!window.location.href.includes('linkedin.com/messaging')) {
      console.log('[MessageExtractor] Navigating to messaging page...');
      window.location.href = 'https://www.linkedin.com/messaging/';
      await this.wait(3000);
    }

    // Wait for the conversation list to be visible
    const selectors = this.getSelectors();
    let listFound = false;
    for (const selector of selectors.CONVERSATION_LIST_CONTAINERS) {
      const container = await this.waitForElement(selector, 5000);
      if (container) {
        console.log(`[MessageExtractor] Found conversation list with: ${selector}`);
        listFound = true;
        break;
      }
    }

    if (!listFound) {
      console.error('[MessageExtractor] Conversation list not found!');
      return [];
    }

    // Wait a bit more for conversations to fully load
    await this.wait(1000);

    // Scroll to load more conversations if needed
    await this.scrollToLoadConversations(limit);

    // Extract conversations with thread IDs (using click method)
    const conversations = await this.extractConversationsWithIds(limit);

    // Optionally extract messages for each conversation
    if (includeMessages && conversations.length > 0) {
      for (let i = 0; i < conversations.length; i++) {
        const conv = conversations[i];
        console.log(`[MessageExtractor] Fetching messages for conversation ${i + 1}/${conversations.length}`);

        try {
          conv.messages = await this.extractMessages();
        } catch (error) {
          console.error(`[MessageExtractor] Error fetching messages for ${conv.linkedin_conversation_id}:`, error);
          conv.messages = [];
        }

        // Small delay between conversations
        await this.wait(500);
      }
    }

    console.log(`[MessageExtractor] Full sync complete. ${conversations.length} conversations.`);
    return conversations;
  },

  /**
   * Scroll the conversation list to load more items
   * @param {number} targetCount - Target number of conversations to load
   */
  async scrollToLoadConversations(targetCount = 50) {
    const selectors = this.getSelectors();

    // Find the list container
    const listContainer = this.findElement(selectors.CONVERSATION_LIST_CONTAINERS);
    if (!listContainer) {
      console.log('[MessageExtractor] No list container found for scrolling');
      return;
    }

    let previousCount = 0;
    let currentCount = this.findAllElements(selectors.CONVERSATION_ITEMS).length;
    let attempts = 0;
    const maxAttempts = 10;

    console.log(`[MessageExtractor] Starting scroll, current count: ${currentCount}, target: ${targetCount}`);

    while (currentCount < targetCount && attempts < maxAttempts) {
      listContainer.scrollTop = listContainer.scrollHeight;
      await this.wait(1000);

      previousCount = currentCount;
      currentCount = this.findAllElements(selectors.CONVERSATION_ITEMS).length;

      console.log(`[MessageExtractor] After scroll: ${currentCount} conversations`);

      // Stop if no new conversations loaded
      if (currentCount === previousCount) {
        attempts++;
      } else {
        attempts = 0;
      }
    }

    // Scroll back to top
    listContainer.scrollTop = 0;
    await this.wait(500);
  },

  /**
   * Parse relative time string to ISO date
   * @param {string} timeStr - Relative time string (e.g., "2h", "3d", "1w")
   * @returns {string|null} ISO date string or null
   */
  parseRelativeTime(timeStr) {
    if (!timeStr) return null;

    const now = new Date();
    const lowerStr = timeStr.toLowerCase().trim();

    // Try to match relative time patterns
    const hourMatch = lowerStr.match(/(\d+)\s*h/);
    const dayMatch = lowerStr.match(/(\d+)\s*d/);
    const weekMatch = lowerStr.match(/(\d+)\s*w/);
    const monthMatch = lowerStr.match(/(\d+)\s*mo/);
    const minuteMatch = lowerStr.match(/(\d+)\s*m(?!o)/);

    if (minuteMatch) {
      now.setMinutes(now.getMinutes() - parseInt(minuteMatch[1], 10));
    } else if (hourMatch) {
      now.setHours(now.getHours() - parseInt(hourMatch[1], 10));
    } else if (dayMatch) {
      now.setDate(now.getDate() - parseInt(dayMatch[1], 10));
    } else if (weekMatch) {
      now.setDate(now.getDate() - parseInt(weekMatch[1], 10) * 7);
    } else if (monthMatch) {
      now.setMonth(now.getMonth() - parseInt(monthMatch[1], 10));
    } else {
      return null;
    }

    return now.toISOString();
  },

  /**
   * Wait for an element to appear in the DOM
   * @param {string} selector - CSS selector
   * @param {number} timeout - Maximum wait time in ms
   * @returns {Promise<Element>}
   */
  waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      setTimeout(() => {
        observer.disconnect();
        // Resolve with null instead of rejecting to avoid errors
        resolve(null);
      }, timeout);
    });
  },

  /**
   * Wait for specified milliseconds
   * @param {number} ms - Milliseconds to wait
   * @returns {Promise<void>}
   */
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Send a message in the current conversation
   * @param {string} content - Message content
   * @returns {Promise<boolean>} Success status
   */
  async sendMessage(content) {
    console.log('[MessageExtractor] Sending message:', content.substring(0, 50) + '...');

    // Find the message input
    const inputSelectors = [
      '.msg-form__contenteditable[contenteditable="true"]',
      '.msg-form__message-texteditor [contenteditable="true"]',
      '[contenteditable="true"][role="textbox"]',
      '.msg-form__contenteditable',
      'div[data-placeholder="Write a message…"]'
    ];

    let input = null;
    for (const selector of inputSelectors) {
      input = document.querySelector(selector);
      if (input) {
        console.log('[MessageExtractor] Found input with:', selector);
        break;
      }
    }

    if (!input) {
      console.error('[MessageExtractor] Message input not found');
      return false;
    }

    // Focus the input
    input.focus();
    await this.wait(300);

    // Clear existing content
    input.innerHTML = '';
    await this.wait(100);

    // Method 1: Type character by character to trigger React properly
    // This simulates actual user typing which React's controlled inputs detect
    const paragraph = document.createElement('p');
    paragraph.textContent = content;
    input.appendChild(paragraph);

    // Dispatch proper sequence of events that React listens to
    input.dispatchEvent(new Event('focus', { bubbles: true }));
    input.dispatchEvent(new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: content
    }));
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: false,
      inputType: 'insertText',
      data: content
    }));

    await this.wait(500);

    // Find send button
    const sendButtonSelectors = [
      'button.msg-form__send-button:not([disabled])',
      'button.msg-form__send-button',
      '.msg-form__send-button',
      'button[type="submit"].msg-form__send-btn',
      'form.msg-form button[type="submit"]',
      'button.msg-form__send-toggle'
    ];

    let sendButton = null;
    for (const selector of sendButtonSelectors) {
      const btn = document.querySelector(selector);
      if (btn) {
        sendButton = btn;
        console.log('[MessageExtractor] Found send button:', selector, 'disabled:', btn.disabled, 'aria-disabled:', btn.getAttribute('aria-disabled'));
        break;
      }
    }

    // Try clicking the send button
    if (sendButton) {
      console.log('[MessageExtractor] Attempting to click send button...');

      // Remove disabled attribute if present
      sendButton.removeAttribute('disabled');
      sendButton.setAttribute('aria-disabled', 'false');
      await this.wait(100);

      // Try multiple click methods
      // Method 1: Direct click
      sendButton.click();
      await this.wait(300);

      // Check if message was sent (input should be empty)
      if (input.textContent.trim() === '') {
        console.log('[MessageExtractor] Message sent successfully (input cleared)');
        return true;
      }

      // Method 2: Simulate full mouse event sequence
      console.log('[MessageExtractor] First click didn\'t work, trying mouse events...');
      const rect = sendButton.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      sendButton.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: centerX, clientY: centerY }));
      sendButton.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: centerX, clientY: centerY }));
      sendButton.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: centerX, clientY: centerY, button: 0 }));
      sendButton.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: centerX, clientY: centerY, button: 0 }));
      sendButton.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: centerX, clientY: centerY, button: 0 }));

      await this.wait(300);

      if (input.textContent.trim() === '') {
        console.log('[MessageExtractor] Message sent successfully via mouse events');
        return true;
      }
    }

    // Method 3: Try Enter key in the input
    console.log('[MessageExtractor] Button click didn\'t work, trying Enter key...');
    input.focus();
    await this.wait(100);

    // Try regular Enter
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));

    await this.wait(300);

    if (input.textContent.trim() === '') {
      console.log('[MessageExtractor] Message sent successfully via Enter key');
      return true;
    }

    // Method 4: Try Ctrl+Enter / Cmd+Enter
    console.log('[MessageExtractor] Regular Enter didn\'t work, trying Ctrl+Enter...');
    input.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      ctrlKey: true,
      metaKey: true
    }));

    await this.wait(500);

    // Final check
    const sent = input.textContent.trim() === '' || input.textContent.trim() !== content;
    console.log('[MessageExtractor] Final send status:', sent);
    return sent;
  },

  /**
   * Watch for new incoming messages in the current conversation
   * Sends new messages to the backend automatically
   * @returns {MutationObserver|null} The observer (call disconnect() to stop)
   */
  startWatchingMessages() {
    console.log('[MessageExtractor] Starting to watch for new messages...');

    // Find the message list container
    const messageListSelectors = [
      '.msg-s-message-list-content',
      '.msg-s-message-list',
      '[class*="message-list"]'
    ];

    let messageList = null;
    for (const selector of messageListSelectors) {
      messageList = document.querySelector(selector);
      if (messageList) {
        console.log('[MessageExtractor] Found message list:', selector);
        break;
      }
    }

    if (!messageList) {
      console.log('[MessageExtractor] Message list not found, cannot watch for new messages');
      return null;
    }

    // Track existing messages to detect new ones
    const existingMessageIds = new Set();
    document.querySelectorAll('.msg-s-message-list__event').forEach(el => {
      const id = el.getAttribute('data-event-urn') || el.id;
      if (id) existingMessageIds.add(id);
    });

    console.log('[MessageExtractor] Tracking', existingMessageIds.size, 'existing messages');

    // Create observer
    const observer = new MutationObserver(async (mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;

          // Check if it's a message element
          const messageElements = node.classList?.contains('msg-s-message-list__event')
            ? [node]
            : node.querySelectorAll?.('.msg-s-message-list__event') || [];

          for (const msgEl of messageElements) {
            const id = msgEl.getAttribute('data-event-urn') || msgEl.id;
            if (id && existingMessageIds.has(id)) continue;
            if (id) existingMessageIds.add(id);

            // Parse the new message
            const message = this.parseMessageElement(msgEl);
            if (!message) continue;

            console.log('[MessageExtractor] New message detected:', message);

            // Only sync incoming messages (not from me)
            if (!message.is_from_me) {
              // Get conversation ID from URL
              const urlMatch = window.location.href.match(/\/messaging\/thread\/([^/]+)/);
              const conversationId = urlMatch ? urlMatch[1] : null;

              if (conversationId && window.ExtensionAPI) {
                // Send to backend
                try {
                  await window.ExtensionAPI.request('/inbox/incoming-message', 'POST', {
                    linkedin_conversation_id: conversationId,
                    message: message
                  });
                  console.log('[MessageExtractor] Incoming message sent to backend');
                } catch (error) {
                  console.error('[MessageExtractor] Failed to send incoming message:', error);
                }
              }
            }
          }
        }
      }
    });

    // Start observing
    observer.observe(messageList, {
      childList: true,
      subtree: true
    });

    // Store observer reference
    this._messageObserver = observer;
    console.log('[MessageExtractor] Now watching for new messages');
    return observer;
  },

  /**
   * Stop watching for messages
   */
  stopWatchingMessages() {
    if (this._messageObserver) {
      this._messageObserver.disconnect();
      this._messageObserver = null;
      console.log('[MessageExtractor] Stopped watching for messages');
    }
  },
};

// Export for use in content script
if (typeof window !== 'undefined') {
  window.MessageExtractor = MessageExtractor;

  // Auto-start message watcher when on a conversation page
  if (window.location.href.includes('/messaging/thread/')) {
    setTimeout(() => {
      if (window.MessageExtractor) {
        window.MessageExtractor.startWatchingMessages();
      }
    }, 2000);
  }
}
