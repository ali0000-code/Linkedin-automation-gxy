/**
 * Content Script
 *
 * Injected into LinkedIn pages to handle:
 * 1. Extraction requests from popup
 * 2. Campaign action execution (visit, invite, message, follow)
 *
 * NOTE: This script runs in the context of the LinkedIn page.
 * It has access to the page's DOM but not the extension's background context.
 */

// Bridge log function - sends logs to main world so they appear in the page console
const csLog = (...args) => {
  console.log(...args);
  try {
    window.postMessage({ type: '__LI_BRIDGE_LOG__', args: args.map(a => typeof a === 'object' ? JSON.stringify(a).substring(0, 300) : String(a)) }, '*');
  } catch (e) {}
};

// Debug command — respond to status requests from page console
window.addEventListener('message', (event) => {
  if (event.data?.type !== '__LI_CS_STATUS__') return;
  csLog(`[Content Script] STATUS: ${interceptedData.conversations.length} conversations parsed, profileUrn: ${cachedProfileUrn || 'null'}`);
  if (interceptedData.conversations.length > 0) {
    const sample = interceptedData.conversations.slice(0, 5).map(c => `${c.participant_name || 'MISSING'}|${c.participant_linkedin_id || 'no-id'}|avatar:${!!c.participant_avatar_url}`);
    csLog(`[Content Script] Sample: ${sample.join(' || ')}`);
  }
});

csLog('[Content Script] LinkedIn Automation extension loaded on:', window.location.href);
csLog('[Content Script] Ready to receive messages from background script');

// CRITICAL: Register interceptor listeners IMMEDIATELY at top of file,
// before any other code that could throw and prevent listener registration.
// Use a temporary queue until interceptedData is fully initialized.
const __interceptQueue = [];
window.addEventListener('message', (event) => {
  if (event.data?.type === '__LI_NET_INTERCEPT__') {
    csLog('[Content Script] 🎯 Intercept received, url:', event.data.url?.substring(0, 80));
    __interceptQueue.push(event.data);
  }
});

// Request replay from the page-context interceptor (it stores captures that happened before we loaded)
// Fetch profile URN first so the parser can correctly identify "self" vs "other" participants
setTimeout(async () => {
  try {
    if (typeof getMyProfileUrn === 'function') await getMyProfileUrn();
  } catch (e) {}
  csLog('[Content Script] Requesting replay (1st), profileUrn:', cachedProfileUrn || 'null');
  window.postMessage({ type: '__LI_REPLAY_REQUEST__' }, '*');
}, 100);
setTimeout(() => {
  csLog('[Content Script] Requesting replay (2nd)');
  window.postMessage({ type: '__LI_REPLAY_REQUEST__' }, '*');
}, 3000);

/**
 * Cache of intercepted messaging data from LinkedIn's own API calls.
 * Populated by the network interceptor via window.postMessage.
 */
const interceptedData = {
  conversations: [],          // Parsed conversation objects
  messagesByConversation: {}, // { conversationId: [messages] }
  lastUpdate: 0,
  rawResponses: [],           // Last 5 raw responses for debugging
};

/**
 * Parse LinkedIn 2025 GraphQL messaging response into conversations.
 *
 * Structure: data.data.messengerConversationsBySyncToken.elements[]
 * Each element has:
 *   - entityUrn: urn:li:msg_conversation:(urn:li:fsd_profile:XXX,2-threadId)
 *   - backendUrn: urn:li:messagingThread:2-threadId
 *   - conversationParticipants[]: {hostIdentityUrn, participantType.member.{firstName,lastName,profileUrl,profilePicture}}
 *   - lastActivityAt, unreadCount
 *   - messages[]: last messages in the thread
 */
function parseInterceptedConversations(data) {
  const conversations = [];

  // Find the GraphQL data wrapper — could be any messengerConversationsByXxx key
  const dataRoot = data.data;
  if (!dataRoot) return conversations;

  const convWrapper = Object.keys(dataRoot)
    .filter(k => k.startsWith('messengerConversations'))
    .map(k => dataRoot[k])
    .find(v => v && Array.isArray(v.elements));

  if (!convWrapper) return conversations;

  const elements = convWrapper.elements;

  for (const conv of elements) {
    try {
      // Extract conversation ID from backendUrn (cleanest format)
      // backendUrn: "urn:li:messagingThread:2-XXXXX"
      const conversationId = conv.backendUrn?.match(/messagingThread:(2-[A-Za-z0-9_=-]+)/)?.[1] ||
                             conv.entityUrn?.match(/,(2-[A-Za-z0-9_=-]+)\)/)?.[1];

      if (!conversationId) continue;

      // Find the OTHER participant (not self)
      let participantName = 'Unknown';
      let participantAvatar = null;
      let participantLinkedinId = null;
      let isOrganization = false;
      let isSponsored = false;

      // Only use profile URN for self-check if it's actually set — otherwise
      // an empty string would match every participant (String.includes('') === true)
      const myProfileUrnShort = cachedProfileUrn ? cachedProfileUrn.split(':').pop() : null;
      const participants = conv.conversationParticipants || [];

      // Helper: extract avatar from vector image
      const getAvatar = (pic) => {
        if (!pic?.rootUrl || !pic.artifacts?.length) return null;
        const artifact = pic.artifacts.find(a => a.width === 200) ||
                         pic.artifacts.find(a => a.width >= 100) ||
                         pic.artifacts[0];
        return artifact ? pic.rootUrl + artifact.fileIdentifyingUrlPathSegment : null;
      };

      for (const p of participants) {
        // Skip self (only if we have the profile URN)
        if (myProfileUrnShort && p.hostIdentityUrn?.includes(myProfileUrnShort)) continue;

        const ptype = p.participantType || {};
        const member = ptype.member;
        const org = ptype.organization;
        const custom = ptype.custom;

        if (member) {
          // Regular member/person
          const firstName = member.firstName?.text || '';
          const lastName = member.lastName?.text || '';
          participantName = `${firstName} ${lastName}`.trim() || 'Unknown';
          const urlMatch = member.profileUrl?.match(/\/in\/([^/?]+)/);
          if (urlMatch) participantLinkedinId = urlMatch[1];
          participantAvatar = getAvatar(member.profilePicture);
        } else if (org) {
          // Business/company page — participantType.organization
          isOrganization = true;
          participantName = org.name?.text || 'Organization';
          participantAvatar = getAvatar(org.logo);
          // Extract company slug from pageUrl as an ID
          // pageUrl: "https://www.linkedin.com/company/companyname/"
          const slugMatch = org.pageUrl?.match(/\/company\/([^/?]+)/);
          if (slugMatch) participantLinkedinId = `company:${slugMatch[1]}`;
        } else if (custom) {
          // Custom participant type (LinkedIn system account for sponsored/offers)
          isSponsored = true;
          participantName = custom.name?.text || 'LinkedIn';
          participantAvatar = getAvatar(custom.logo || custom.image);
        } else {
          // Fallback: try any name/image fields directly on the participant
          participantName = p.name?.text || p.preview?.text || 'Unknown';
        }
        break;
      }

      // Also check top-level conv.title for group chats / named conversations
      if (participantName === 'Unknown' && conv.title?.text) {
        participantName = conv.title.text;
      }

      // Detect sponsored/promotional conversations
      if (conv.categories?.includes('SPONSORED') ||
          conv.categories?.includes('INMAIL_SPONSORED') ||
          conv.contentMetadata?.sponsoredConversationContent) {
        isSponsored = true;
      }

      // Skip sponsored/promotional conversations — they're not real user messages
      if (isSponsored) {
        console.log(`[Content Script] Skipping sponsored conversation: ${participantName}`);
        continue;
      }

      // Skip archived conversations (user moved them out of inbox)
      if (conv.categories?.includes('ARCHIVE')) {
        continue;
      }

      // Extract last message from messages array (if present)
      let lastMessageText = '';
      const msgs = conv.messages?.elements || conv.messages || [];
      if (Array.isArray(msgs) && msgs.length > 0) {
        const lastMsg = msgs[msgs.length - 1];
        lastMessageText = lastMsg?.body?.text || '';
      }

      conversations.push({
        // Backend expects snake_case field names (see InboxController::sync validation)
        linkedin_conversation_id: conversationId,
        participant_name: participantName,
        participant_avatar_url: participantAvatar,
        participant_linkedin_id: participantLinkedinId,
        last_message_preview: lastMessageText,
        last_message_at: conv.lastActivityAt ? new Date(conv.lastActivityAt).toISOString() : null,
        unread_count: conv.unreadCount || 0,
        is_unread: (conv.unreadCount || 0) > 0,
      });
    } catch (e) {
      console.warn('[Content Script] Failed to parse conversation:', e.message);
    }
  }

  return conversations;
}

/**
 * Parse LinkedIn 2025 GraphQL messages response.
 * Structure: data.data.messengerMessagesBySyncToken.elements[]
 * Each element: {entityUrn, backendUrn, body.text, deliveredAt, sender.hostIdentityUrn}
 */
function parseInterceptedMessages(data, conversationId) {
  const messages = [];
  const dataRoot = data.data;
  if (!dataRoot) return messages;

  // Find messages wrapper
  const msgWrapper = Object.keys(dataRoot)
    .filter(k => k.startsWith('messengerMessages'))
    .map(k => dataRoot[k])
    .find(v => v && Array.isArray(v.elements));

  if (!msgWrapper) return messages;

  const myProfileUrnShort = cachedProfileUrn?.split(':').pop() || '';

  for (const msg of msgWrapper.elements) {
    if (!msg.body?.text) continue;

    // Check if sender is self
    const senderUrn = msg.sender?.hostIdentityUrn || '';
    const isFromMe = myProfileUrnShort && senderUrn.includes(myProfileUrnShort);

    // Extract conversation ID from entityUrn if not provided
    let msgConvId = conversationId;
    if (!msgConvId) {
      msgConvId = msg.entityUrn?.match(/,(2-[A-Za-z0-9_=-]+)\)/)?.[1] || '';
    }

    messages.push({
      conversationId: msgConvId,
      content: msg.body.text,
      senderName: isFromMe ? 'You' : (msg.sender?.participantType?.member?.firstName?.text || 'Unknown'),
      timestamp: msg.deliveredAt || 0,
      isFromMe,
      linkedinMessageId: msg.backendUrn || msg.entityUrn || null,
    });
  }

  return messages.sort((a, b) => a.timestamp - b.timestamp);
}

// Listen for debug trigger from page console
window.addEventListener('message', (event) => {
  if (event.data?.type !== '__LI_DEBUG__') return;
  console.log('=== LinkedIn Interceptor Debug ===');
  console.log('Total conversations parsed:', interceptedData.conversations.length);
  console.log('Last update:', interceptedData.lastUpdate ? new Date(interceptedData.lastUpdate).toLocaleTimeString() : 'never');
  console.log('Raw responses captured:', interceptedData.rawResponses.length);
  console.log('Recent responses:');
  interceptedData.rawResponses.forEach((r, i) => {
    console.log(`  ${i + 1}. included=${r.includedCount} elements=${r.elementsCount} | ${r.url.substring(0, 120)}`);
  });
  console.log('Conversations:');
  console.table(interceptedData.conversations.map(c => ({
    id: c.linkedin_conversation_id?.substring(0, 20) + '...',
    name: c.participant_name,
    lastMsg: c.lastMessage?.substring(0, 30)
  })));
});

// Process a single intercept message (called from both listener and queue flush)
function handleInterceptMessage(eventData) {
  const { url, data } = eventData;

  // Keep last 10 raw responses for debugging
  interceptedData.rawResponses = [
    { url, keys: Object.keys(data), includedCount: data.included?.length || 0, elementsCount: (data.data?.elements || data.elements || []).length, time: Date.now() },
    ...interceptedData.rawResponses.slice(0, 9)
  ];

  // Parse conversations from the response
  const conversations = parseInterceptedConversations(data);
  if (conversations.length > 0) {
    // Track which conversations have NEW messages since last sync
    const previousByConvId = new Map(interceptedData.conversations.map(c => [c.linkedin_conversation_id, c]));
    const conversationsWithNewMessages = [];

    for (const conv of conversations) {
      const previous = previousByConvId.get(conv.linkedin_conversation_id);
      // New message detected if: last_message_at is newer than what we had, OR conversation is new and unread
      if (previous) {
        const prevTime = previous.last_message_at ? new Date(previous.last_message_at).getTime() : 0;
        const newTime = conv.last_message_at ? new Date(conv.last_message_at).getTime() : 0;
        if (newTime > prevTime) {
          conversationsWithNewMessages.push(conv.linkedin_conversation_id);
        }
      }
    }

    // Merge with existing — newer data wins
    const existing = new Map(previousByConvId);
    for (const conv of conversations) {
      existing.set(conv.linkedin_conversation_id, conv);
    }
    interceptedData.conversations = Array.from(existing.values());
    interceptedData.lastUpdate = Date.now();

    // Also store in chrome.storage for persistence
    chrome.storage.local.set({ intercepted_conversations: interceptedData.conversations });

    csLog(`[Content Script] ✅ Intercepted ${conversations.length} conversations (total: ${interceptedData.conversations.length})`);

    // Auto-sync: if any conversation has new messages since last time,
    // push them to the backend immediately (catches up after LinkedIn tab was closed)
    if (conversationsWithNewMessages.length > 0) {
      csLog(`[Content Script] 🔄 Auto-sync: ${conversationsWithNewMessages.length} conversations have new messages`);
      chrome.runtime.sendMessage({
        type: 'AUTO_SYNC_CONVERSATIONS',
        conversationIds: conversationsWithNewMessages,
        conversations: interceptedData.conversations.filter(c => conversationsWithNewMessages.includes(c.linkedin_conversation_id))
      }).catch(() => {});
    }
  }

  // Parse messages if this is a conversation-specific response
  if (url.includes('events') || url.includes('messengerMessages')) {
    // Try to extract conversation ID from URL
    const threadMatch = url.match(/conversations\/([^/?]+)/) || url.match(/conversationUrn[^)]*,([^)]+)\)/);
    const convId = threadMatch?.[1];
    if (convId) {
      const messages = parseInterceptedMessages(data, convId);
      if (messages.length > 0) {
        interceptedData.messagesByConversation[convId] = messages;
        csLog(`[Content Script] Intercepted ${messages.length} messages for conv ${convId.substring(0, 20)}`);
      }
    }
  }
}

// Flush any messages that were queued before handleInterceptMessage was defined
csLog(`[Content Script] Flushing ${__interceptQueue.length} queued intercept messages`);
for (const queued of __interceptQueue) {
  handleInterceptMessage(queued);
}
__interceptQueue.length = 0;

// Replace the early queue listener with direct processing
window.addEventListener('message', (event) => {
  if (event.data?.type !== '__LI_NET_INTERCEPT__') return;
  handleInterceptMessage(event.data);
});

// Listen for realtime events pushed from LinkedIn's SSE stream
// Parse the message data directly from the realtime payload and send to backend immediately
window.addEventListener('message', async (event) => {
  if (event.data?.type !== '__LI_REALTIME__') return;
  const { data } = event.data;

  try {
    const profileUrn = await getMyProfileUrn();
    const myUrnShort = profileUrn?.split(':').pop();

    // Recursively find message entities in the realtime payload
    const findMessages = (obj, depth = 0, found = []) => {
      if (!obj || depth > 6 || typeof obj !== 'object') return found;
      // Looks like a message: has body.text + entityUrn/backendUrn
      if (obj.body?.text && (obj.entityUrn || obj.backendUrn)) {
        found.push(obj);
      }
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'object') findMessages(obj[key], depth + 1, found);
      }
      return found;
    };

    const messages = findMessages(data);
    if (messages.length === 0) return;

    csLog(`[Content Script] 📡 Realtime: ${messages.length} new message(s)`);

    // Parse each message and send to backend directly via background
    for (const msg of messages) {
      // Extract conversation ID from the message's entityUrn.
      // CAUTION: The "2-XXX" in a message URN is the MESSAGE ID, not the conversation ID.
      // The message ID encodes: "{timestamp}-{seq}&{conversationUuid}"
      // We need to decode it, split by &, and re-encode the conversation part.
      const msgIdMatch = msg.entityUrn?.match(/,(2-[A-Za-z0-9_=+/\-]+)\)/);
      if (!msgIdMatch) continue;

      let conversationId = null;
      try {
        // Strip "2-" prefix, base64 decode
        const b64 = msgIdMatch[1].substring(2);
        const decoded = atob(b64);
        // Format: "timestamp-seq&convUuid_NNN"
        const ampIdx = decoded.indexOf('&');
        if (ampIdx === -1) {
          // No & means this IS the conversation ID (not a message compound ID)
          conversationId = msgIdMatch[1];
        } else {
          const convUuid = decoded.substring(ampIdx + 1);
          // Re-encode as base64 to match the format used by conversation list sync
          conversationId = '2-' + btoa(convUuid);
        }
      } catch (e) {
        // Fallback: use the raw ID as-is (might work if it's already a conversation ID)
        conversationId = msgIdMatch[1];
      }

      if (!conversationId) continue;

      // Determine if it's from self
      const senderUrn = msg.sender?.hostIdentityUrn || msg['*sender'] || '';
      const isFromMe = myUrnShort && senderUrn.includes(myUrnShort);
      if (isFromMe) continue; // Skip our own messages

      const senderName = msg.sender?.participantType?.member?.firstName?.text
        ? `${msg.sender.participantType.member.firstName.text} ${msg.sender.participantType.member.lastName?.text || ''}`.trim()
        : 'Unknown';

      const messagePayload = {
        conversationId,
        participantName: senderName,
        message: {
          content: msg.body.text,
          sender_name: senderName,
          timestamp: msg.deliveredAt || Date.now(),
          sent_at: new Date(msg.deliveredAt || Date.now()).toISOString(),
          linkedin_message_id: msg.backendUrn || msg.entityUrn || null,
          is_from_me: false,
        }
      };

      csLog(`[Content Script] 📡 Sending realtime message to backend: "${msg.body.text.substring(0, 40)}" from ${senderName}`);

      // Send to background which forwards to backend
      chrome.runtime.sendMessage({
        type: 'REALTIME_INCOMING_MESSAGE',
        payload: messagePayload
      }).catch(() => {});
    }
  } catch (e) {
    console.error('[Content Script] Realtime parsing error:', e);
  }
});

/**
 * Initialize queue processor when page loads
 * This handles resuming the queue after page navigation
 */
async function initQueueProcessor() {
  // Wait a bit for all scripts to load
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Check if queue processor is available
  if (typeof window.QueueProcessor !== 'undefined') {
    console.log('[Content Script] Initializing queue processor');
    await window.QueueProcessor.init();
  } else {
    console.warn('[Content Script] Queue processor not loaded');
  }
}

// Initialize queue processor
initQueueProcessor();

/**
 * Get CSRF token from cookies (used for LinkedIn API calls)
 * @returns {string|null} The CSRF token or null if not found
 */
function getCsrfToken() {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'JSESSIONID') {
      return value.replace(/"/g, '');
    }
  }
  return null;
}

// Profile URN cache (1 hour expiry)
let cachedProfileUrn = null;
let profileUrnCacheTime = 0;
const PROFILE_URN_CACHE_DURATION = 60 * 60 * 1000; // 1 hour

/**
 * Get my LinkedIn profile URN (cached)
 * @returns {Promise<string|null>} The profile URN or null
 */
async function getMyProfileUrn() {
  // Return cached if valid
  if (cachedProfileUrn && (Date.now() - profileUrnCacheTime) < PROFILE_URN_CACHE_DURATION) {
    console.log('[Content Script] Using cached profile URN:', cachedProfileUrn);
    return cachedProfileUrn;
  }

  const csrfToken = getCsrfToken();
  if (!csrfToken) return null;

  try {
    // Try the identity endpoint first (returns fsd_profile URN)
    const response = await fetch('https://www.linkedin.com/voyager/api/voyagerIdentityDashProfiles?q=memberIdentity&memberIdentity=me', {
      headers: {
        'accept': 'application/vnd.linkedin.normalized+json+2.1',
        'csrf-token': csrfToken,
        'x-restli-protocol-version': '2.0.0'
      },
      credentials: 'include'
    });

    if (response.ok) {
      const data = await response.json();
      // Find the fsd_profile URN in included array
      for (const entity of (data.included || [])) {
        if (entity.entityUrn?.startsWith('urn:li:fsd_profile:')) {
          cachedProfileUrn = entity.entityUrn;
          profileUrnCacheTime = Date.now();
          console.log('[Content Script] Cached profile URN:', cachedProfileUrn);
          return cachedProfileUrn;
        }
      }
    }

    // Fallback: try /me endpoint
    const meResponse = await fetch('https://www.linkedin.com/voyager/api/me', {
      headers: {
        'accept': 'application/vnd.linkedin.normalized+json+2.1',
        'csrf-token': csrfToken,
        'x-restli-protocol-version': '2.0.0'
      },
      credentials: 'include'
    });

    if (meResponse.ok) {
      const meData = await meResponse.json();
      // Check various locations for profile URN
      cachedProfileUrn = meData.miniProfile?.entityUrn ||
                         meData.entityUrn ||
                         meData.included?.find(e => e.entityUrn?.includes('fsd_profile'))?.entityUrn;
      if (cachedProfileUrn) {
        profileUrnCacheTime = Date.now();
        console.log('[Content Script] Cached profile URN (from /me):', cachedProfileUrn);
        return cachedProfileUrn;
      }
    }
  } catch (e) {
    console.log('[Content Script] Failed to get profile URN:', e.message);
  }

  return null;
}

// ==================== RATE LIMITER ====================

/**
 * Rate limiter for LinkedIn API calls
 * Uses a fixed-size circular buffer to limit memory usage
 * Limits to 60 requests per minute (1 per second average)
 */
const rateLimiter = {
  // Fixed-size circular buffer for request timestamps
  requests: new Array(60).fill(0), // Pre-allocated array
  head: 0, // Next position to write
  count: 0, // Number of valid entries
  maxRequests: 60,
  windowMs: 60 * 1000, // 1 minute

  // Clean expired entries and return count of valid ones
  _cleanup() {
    const now = Date.now();
    let validCount = 0;
    for (let i = 0; i < this.count; i++) {
      const idx = (this.head - this.count + i + this.maxRequests) % this.maxRequests;
      if (now - this.requests[idx] < this.windowMs) {
        validCount++;
      }
    }
    // If entries expired, update count (circular buffer handles the rest)
    if (validCount < this.count) {
      this.count = validCount;
    }
    return validCount;
  },

  canMakeRequest() {
    return this._cleanup() < this.maxRequests;
  },

  recordRequest() {
    // Add to circular buffer (overwrites oldest if full)
    this.requests[this.head] = Date.now();
    this.head = (this.head + 1) % this.maxRequests;
    if (this.count < this.maxRequests) {
      this.count++;
    }
  },

  async waitForSlot() {
    while (!this.canMakeRequest()) {
      // Find oldest valid request
      const now = Date.now();
      let oldestTime = now;
      for (let i = 0; i < this.count; i++) {
        const idx = (this.head - this.count + i + this.maxRequests) % this.maxRequests;
        if (this.requests[idx] < oldestTime && now - this.requests[idx] < this.windowMs) {
          oldestTime = this.requests[idx];
        }
      }
      const waitTime = Math.max(100, oldestTime + this.windowMs - now + 100);
      console.log(`[Rate Limiter] Waiting ${waitTime}ms for rate limit...`);
      await new Promise(resolve => setTimeout(resolve, Math.min(waitTime, 5000)));
    }
  },

  getStatus() {
    const validCount = this._cleanup();
    const now = Date.now();
    let oldestTime = now;
    for (let i = 0; i < this.count; i++) {
      const idx = (this.head - this.count + i + this.maxRequests) % this.maxRequests;
      if (this.requests[idx] < oldestTime && now - this.requests[idx] < this.windowMs) {
        oldestTime = this.requests[idx];
      }
    }
    return {
      used: validCount,
      remaining: this.maxRequests - validCount,
      resetsIn: validCount > 0 ? Math.max(0, oldestTime + this.windowMs - now) : 0
    };
  }
};

/**
 * Rate-limited fetch wrapper for LinkedIn API
 * Handles rate limiting and common errors (429, 401, 403)
 */
async function linkedInFetch(url, options = {}) {
  // Wait for rate limit slot
  await rateLimiter.waitForSlot();

  // Record this request
  rateLimiter.recordRequest();

  const response = await fetch(url, {
    ...options,
    credentials: 'include'
  });

  // Handle rate limiting (429)
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After') || 60;
    console.log(`[LinkedIn API] Rate limited! Waiting ${retryAfter}s...`);
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
    // Retry once
    rateLimiter.recordRequest();
    return fetch(url, { ...options, credentials: 'include' });
  }

  // Handle auth errors (401, 403)
  if (response.status === 401 || response.status === 403) {
    console.error('[LinkedIn API] Authentication error:', response.status);
    // Notify background script about auth failure
    try {
      chrome.runtime.sendMessage({
        type: 'LINKEDIN_AUTH_ERROR',
        status: response.status,
        message: response.status === 401 ? 'Session expired' : 'Access forbidden'
      });
    } catch (e) {}
    throw new Error(`LinkedIn auth error: ${response.status}. Please refresh LinkedIn and try again.`);
  }

  return response;
}

/**
 * Listen for messages from popup and background
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Content Script] Received message:', message.type);

  // ==================== PING - Must be first for reliability ====================

  // Handle PING first - this is critical for checking if content script is loaded
  if (message.type === 'PING') {
    console.log('[Content Script] PING received, responding with ready status');
    sendResponse({
      success: true,
      message: 'Content script is ready',
      queueAvailable: typeof window.QueueProcessor !== 'undefined',
      executorAvailable: typeof window.ActionExecutor !== 'undefined',
      isProfilePage: window.location.href.includes('linkedin.com/in/'),
      url: window.location.href
    });
    return true;
  }

  // ==================== EXTRACTION MESSAGES ====================

  if (message.type === 'START_EXTRACTION') {
    // Handle extraction asynchronously
    handleExtraction(message.limit)
      .then(sendResponse)
      .catch(error => {
        console.error('[Content Script] Extraction error:', error);
        sendResponse({
          success: false,
          error: error.message || 'Extraction failed'
        });
      });

    // Return true to indicate async response
    return true;
  }

  // Get profile image from current LinkedIn profile page
  if (message.type === 'GET_PROFILE_IMAGE') {
    let imageUrl = null;
    // The prospect's main photo uses "profile-framedphoto" (400x400).
    // The user's own nav photo uses "profile-displayphoto" (100x100) — skip that.
    const img = document.querySelector('img[src*="profile-framedphoto"]') ||
                document.querySelector('.pv-top-card-profile-picture__image') ||
                document.querySelector('img[src*="profile-displayphoto-shrink_400"]') ||
                document.querySelector('img[src*="profile-displayphoto-shrink_200"]');
    if (img?.src && !img.src.includes('ghost')) {
      imageUrl = img.src;
    }
    sendResponse({ image_url: imageUrl });
    return true;
  }

  // Stop extraction request
  if (message.type === 'STOP_EXTRACTION') {
    console.log('[Content Script] Stop extraction requested');

    // Call stopExtraction function from extractor service
    if (typeof stopExtraction === 'function') {
      stopExtraction();
      sendResponse({ success: true, message: 'Stop signal sent' });
    } else {
      console.warn('[Content Script] stopExtraction function not available');
      sendResponse({ success: false, error: 'Stop function not available' });
    }

    return true;
  }

  // ==================== QUEUE MESSAGES ====================

  // Start queue processing
  if (message.type === 'START_QUEUE') {
    console.log('[Content Script] Starting queue processor');

    if (typeof window.QueueProcessor !== 'undefined') {
      window.QueueProcessor.start()
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
    } else {
      sendResponse({ success: false, error: 'Queue processor not loaded' });
    }

    return true;
  }

  // Pause queue processing
  if (message.type === 'PAUSE_QUEUE') {
    console.log('[Content Script] Pausing queue processor');

    if (typeof window.QueueProcessor !== 'undefined') {
      window.QueueProcessor.pause();
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Queue processor not loaded' });
    }

    return true;
  }

  // Stop queue processing
  if (message.type === 'STOP_QUEUE') {
    console.log('[Content Script] Stopping queue processor');

    if (typeof window.QueueProcessor !== 'undefined') {
      window.QueueProcessor.stop(message.reason || 'User stopped');
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Queue processor not loaded' });
    }

    return true;
  }

  // Get queue status
  if (message.type === 'GET_QUEUE_STATUS') {
    if (typeof window.QueueProcessor !== 'undefined') {
      sendResponse({
        success: true,
        status: window.QueueProcessor.getStatus()
      });
    } else {
      sendResponse({
        success: false,
        error: 'Queue processor not loaded'
      });
    }

    return true;
  }

  // ==================== EMAIL EXTRACTION MESSAGES ====================

  // Extract email from current profile page
  if (message.type === 'EXTRACT_EMAIL') {
    console.log('[Content Script] Email extraction requested');

    // Check if we're on a profile page
    if (!window.location.href.includes('linkedin.com/in/')) {
      sendResponse({
        success: false,
        error: 'Please navigate to a LinkedIn profile page first'
      });
      return true;
    }

    // Check if extraction function exists
    if (typeof extractEmailFromProfile !== 'function') {
      sendResponse({
        success: false,
        error: 'Email extractor not loaded. Please refresh the page.'
      });
      return true;
    }

    // Perform email extraction
    extractEmailFromProfile()
      .then(result => {
        console.log('[Content Script] Email extraction result:', result);
        sendResponse(result);
      })
      .catch(error => {
        console.error('[Content Script] Email extraction error:', error);
        sendResponse({
          success: false,
          error: error.message || 'Email extraction failed'
        });
      });

    return true;
  }

  // ==================== INBOX SYNC MESSAGES ====================

  // Sync inbox conversations
  if (message.type === 'SYNC_INBOX') {
    console.log('[Content Script] Inbox sync requested');

    if (typeof window.MessageExtractor === 'undefined') {
      sendResponse({
        success: false,
        error: 'Message extractor not loaded. Please refresh the page.'
      });
      return true;
    }

    // Perform sync
    window.MessageExtractor.performFullSync(message.includeMessages || false, message.limit || 50)
      .then(async conversations => {
        // Send to backend API
        try {
          const response = await window.ExtensionAPI.request('/inbox/sync', 'POST', {
            conversations: conversations
          });
          sendResponse({
            success: true,
            conversations: conversations.length,
            message: response.message
          });
        } catch (error) {
          // Still return conversations even if API fails
          sendResponse({
            success: true,
            conversations: conversations.length,
            apiError: error.message
          });
        }
      })
      .catch(error => {
        console.error('[Content Script] Inbox sync error:', error);
        sendResponse({
          success: false,
          error: error.message || 'Inbox sync failed'
        });
      });

    return true;
  }

  // Sync messages for a specific conversation
  if (message.type === 'SYNC_CONVERSATION_MESSAGES') {
    console.log('[Content Script] Conversation messages sync requested');

    if (typeof window.MessageExtractor === 'undefined') {
      sendResponse({
        success: false,
        error: 'Message extractor not loaded.'
      });
      return true;
    }

    window.MessageExtractor.openAndExtractMessages(message.conversationId)
      .then(async messages => {
        // Send to backend API
        try {
          const response = await window.ExtensionAPI.request(
            `/inbox/${message.backendConversationId}/sync-messages`,
            'POST',
            { messages: messages }
          );
          sendResponse({
            success: true,
            messages: messages.length,
            message: response.message
          });
        } catch (error) {
          sendResponse({
            success: true,
            messages: messages.length,
            apiError: error.message
          });
        }
      })
      .catch(error => {
        sendResponse({
          success: false,
          error: error.message
        });
      });

    return true;
  }

  // Open a conversation (pre-load for faster sending)
  if (message.type === 'OPEN_CONVERSATION') {
    console.log('[Content Script] Open conversation requested:', message.conversationId);

    const conversationUrl = `https://www.linkedin.com/messaging/thread/${message.conversationId}/`;

    if (!window.location.href.includes(message.conversationId)) {
      window.location.href = conversationUrl;
    }

    sendResponse({ success: true, message: 'Navigating to conversation' });
    return true;
  }

  // Sync conversations via LinkedIn API (from content script for correct origin)
  // Sync conversations — uses MessageExtractor click method (reliable) with
  // REST message fetching. LinkedIn removed their GraphQL/REST conversation list
  // endpoints (500/400) so click-based extraction is the only working method.
  if (message.type === 'SYNC_CONVERSATIONS_VIA_API') {
    console.log('[Content Script] Sync conversations requested');

    // LinkedIn uses a "Load more conversations" button (not infinite scroll).
    // Click it repeatedly until all conversations are loaded or the button disappears.
    const loadMoreConversations = async (targetCount) => {
      csLog(`[Content Script] Loading more conversations via button click (target: ${targetCount})`);

      const maxAttempts = 20; // Max ~400 conversations (20 per click)

      for (let i = 0; i < maxAttempts; i++) {
        if (interceptedData.conversations.length >= targetCount) break;

        // Find "Load more conversations" button by text
        let loadMoreButton = null;
        for (const btn of document.querySelectorAll('button')) {
          const text = btn.textContent?.trim() || '';
          if (text.includes('Load more conversations') || text === 'Load more') {
            loadMoreButton = btn;
            break;
          }
        }

        if (!loadMoreButton) {
          csLog(`[Content Script] No more "Load more" button — stopping (${interceptedData.conversations.length} total)`);
          break;
        }

        const countBefore = interceptedData.conversations.length;

        // Click the button
        loadMoreButton.scrollIntoView({ behavior: 'instant', block: 'end' });
        await new Promise(r => setTimeout(r, 300));
        loadMoreButton.click();

        // Wait for LinkedIn to fetch + interceptor to capture + content script to parse
        await new Promise(r => setTimeout(r, 2000));

        const countAfter = interceptedData.conversations.length;
        if (countAfter === countBefore) {
          csLog(`[Content Script] Click ${i + 1} didn't add new conversations, stopping`);
          break;
        }
        csLog(`[Content Script] Click ${i + 1}: ${countAfter} conversations captured`);
      }
    };

    const syncConversations = async () => {
      const count = message.count || 100;

      // Ensure we're on the messaging page so scrolling works
      if (!window.location.href.includes('/messaging')) {
        csLog('[Content Script] Navigating to messaging to trigger interception...');
        window.location.href = 'https://www.linkedin.com/messaging/';
        for (let i = 0; i < 15; i++) {
          await new Promise(r => setTimeout(r, 1000));
          if (interceptedData.conversations.length > 0) break;
        }
      } else {
        // Wait briefly for initial interception
        for (let i = 0; i < 5; i++) {
          if (interceptedData.conversations.length > 0) break;
          await new Promise(r => setTimeout(r, 500));
        }
      }

      // Click "Load more conversations" button to load all (up to target count)
      if (interceptedData.conversations.length > 0 && interceptedData.conversations.length < count) {
        await loadMoreConversations(count);
      }

      // Strategy 1: Return intercepted data (now includes all scrolled conversations)
      if (interceptedData.conversations.length > 0) {
        const age = Date.now() - interceptedData.lastUpdate;
        csLog(`[Content Script] Returning ${interceptedData.conversations.length} intercepted conversations (${Math.round(age / 1000)}s old)`);
        return interceptedData.conversations.slice(0, count);
      }

      // Fallback: check chrome.storage for stale intercepted data
      try {
        const stored = await chrome.storage.local.get('intercepted_conversations');
        if (stored.intercepted_conversations?.length > 0) {
          csLog(`[Content Script] Using ${stored.intercepted_conversations.length} stored conversations (stale)`);
          return stored.intercepted_conversations.slice(0, count);
        }
      } catch (e) { /* ignore */ }

      throw new Error('No conversations found. Open LinkedIn Messaging and try again.');
    };

    syncConversations()
      .then(conversations => {
        console.log('[Content Script] Sync success:', conversations.length, 'conversations');
        sendResponse({ success: true, conversations });
      })
      .catch(error => {
        console.error('[Content Script] Sync error:', error.message);
        sendResponse({ success: false, error: error.message });
      });

    return true;
  }

  // Send a message via LinkedIn API (from content script for correct origin)
  if (message.type === 'SEND_MESSAGE_VIA_API') {
    console.log('[Content Script] Send message via API requested');

    const sendViaApi = async () => {
      const conversationId = message.conversationId;
      const content = message.content;

      // Get CSRF token
      const csrfToken = getCsrfToken();
      if (!csrfToken) {
        throw new Error('CSRF token not found. Please refresh the page.');
      }

      // Get current user's profile URN (cached)
      const profileUrn = await getMyProfileUrn();
      if (!profileUrn) {
        throw new Error('Could not get profile URN');
      }
      console.log('[Content Script] Profile URN:', profileUrn);

      // Generate UUID
      const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };

      // Generate tracking ID as raw bytes (LinkedIn's format)
      const generateTrackingId = () => {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        return String.fromCharCode.apply(null, bytes);
      };

      // Build request body (exact format LinkedIn uses)
      const body = {
        dedupeByClientGeneratedToken: false,
        mailboxUrn: profileUrn,
        message: {
          body: {
            attributes: [],
            text: content
          },
          conversationUrn: `urn:li:msg_conversation:(${profileUrn},${conversationId})`,
          originToken: generateUUID(),
          renderContentUnions: []
        },
        trackingId: generateTrackingId()
      };

      console.log('[Content Script] Sending to API...');
      console.log('[Content Script] Body:', JSON.stringify(body));

      // Mark message as sent to avoid it being detected as incoming
      if (window.MessageExtractor?.markMessageAsSent) {
        window.MessageExtractor.markMessageAsSent(content);
      }

      // Try sending with retry logic
      const maxRetries = 2;
      let lastError = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            console.log(`[Content Script] Retry attempt ${attempt}...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
          }

          const response = await linkedInFetch('https://www.linkedin.com/voyager/api/voyagerMessagingDashMessengerMessages?action=createMessage', {
            method: 'POST',
            headers: {
              'accept': 'application/json',
              'content-type': 'text/plain;charset=UTF-8',
              'csrf-token': csrfToken,
              'x-li-lang': 'en_US',
              'x-li-page-instance': `urn:li:page:d_flagship3_messaging_conversation_detail;${generateUUID().replace(/-/g, '').substring(0, 22)}==`,
              'x-li-track': JSON.stringify({
                clientVersion: '1.13.41695',
                mpVersion: '1.13.41695',
                osName: 'web',
                timezoneOffset: new Date().getTimezoneOffset() * -1,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                deviceFormFactor: 'DESKTOP',
                mpName: 'voyager-web',
                displayDensity: 2,
                displayWidth: window.screen.width,
                displayHeight: window.screen.height
              }),
              'x-restli-protocol-version': '2.0.0'
            },
            body: JSON.stringify(body)
          });

          const responseText = await response.text();
          console.log('[Content Script] Response status:', response.status);
          console.log('[Content Script] Response:', responseText);

          if (!response.ok) {
            throw new Error(`API error ${response.status}: ${responseText}`);
          }

          const data = JSON.parse(responseText);
          return {
            success: true,
            messageId: data?.value?.createdEventUrn || data?.value?.entityUrn || null
          };
        } catch (error) {
          lastError = error;
          console.log(`[Content Script] Send attempt ${attempt + 1} failed:`, error.message);

          // Don't retry on certain errors
          if (error.message.includes('403') || error.message.includes('401')) {
            break; // Auth errors - don't retry
          }
        }
      }

      throw lastError || new Error('Failed to send message after retries');
    };

    sendViaApi()
      .then(result => {
        console.log('[Content Script] API send success:', result);
        sendResponse(result);
      })
      .catch(error => {
        console.error('[Content Script] API send error:', error);
        sendResponse({ success: false, error: error.message });
      });

    return true;
  }

  // Send a message in LinkedIn (assumes conversation is already open via pre-open)
  if (message.type === 'SEND_LINKEDIN_MESSAGE') {
    console.log('[Content Script] Send LinkedIn message requested');
    console.log('[Content Script] Current URL:', window.location.href);
    console.log('[Content Script] Target conversation:', message.linkedinConversationId);

    if (typeof window.MessageExtractor === 'undefined') {
      sendResponse({
        success: false,
        error: 'Message extractor not loaded.'
      });
      return true;
    }

    const sendMsg = async () => {
      // Check if we're on the right conversation
      const isOnCorrectConversation = window.location.href.includes(message.linkedinConversationId);

      if (!isOnCorrectConversation) {
        // If not on correct conversation, tell background to navigate first
        // Don't navigate here as it will reload the content script
        console.log('[Content Script] Not on correct conversation, requesting navigation...');
        throw new Error('Please click on the conversation first to open it, then try sending again.');
      }

      // Wait for the message input to be ready
      console.log('[Content Script] Waiting for message input...');
      const inputSelectors = [
        '.msg-form__contenteditable[contenteditable="true"]',
        '.msg-form__contenteditable',
        '[contenteditable="true"][role="textbox"]'
      ];

      let inputFound = false;
      for (const selector of inputSelectors) {
        const input = await window.MessageExtractor.waitForElement(selector, 3000);
        if (input) {
          console.log('[Content Script] Found input:', selector);
          inputFound = true;
          break;
        }
      }

      if (!inputFound) {
        throw new Error('Message input not found. Please make sure the conversation is fully loaded.');
      }

      // Send the message
      console.log('[Content Script] Sending message...');
      const success = await window.MessageExtractor.sendMessage(message.content);
      console.log('[Content Script] Send result:', success);

      if (success && message.messageId) {
        // Mark message as sent in backend (fire and forget)
        window.ExtensionAPI.request(
          `/inbox/messages/${message.messageId}/mark-sent`,
          'POST',
          { success: true }
        ).catch(error => {
          console.error('[Content Script] Failed to mark message as sent:', error);
        });
      }

      return success;
    };

    sendMsg()
      .then(success => {
        console.log('[Content Script] Sending response, success:', success);
        sendResponse({ success: success });
      })
      .catch(error => {
        console.error('[Content Script] Send message error:', error);
        sendResponse({
          success: false,
          error: error.message
        });
      });

    return true;
  }

  // ==================== UTILITY MESSAGES ====================

  // Fetch messages for multiple conversations (used during sync)
  if (message.type === 'FETCH_MESSAGES_FOR_CONVERSATIONS') {
    console.log('[Content Script] Fetching messages for conversations...');

    const fetchMessages = async () => {
      const conversationIds = message.conversationIds || [];
      const conversationMessages = {};

      // Get CSRF token
      const csrfToken = getCsrfToken();
      if (!csrfToken) {
        throw new Error('Not logged in to LinkedIn');
      }

      for (const conversationId of conversationIds) {
        try {
          console.log('[Content Script] Fetching messages for:', conversationId);

          // Use direct conversation ID format (works!)
          let response = await linkedInFetch(
            `https://www.linkedin.com/voyager/api/messaging/conversations/${conversationId}/events?count=20`,
            {
              headers: {
                'accept': 'application/vnd.linkedin.normalized+json+2.1',
                'csrf-token': csrfToken,
                'x-restli-protocol-version': '2.0.0'
              }
            }
          );

          if (response.ok) {
            const data = await response.json();
            const included = data.included || [];
            const elements = data.data?.elements || data.elements || [];

            // Build entity map
            const entityMap = {};
            for (const entity of included) {
              if (entity.entityUrn) entityMap[entity.entityUrn] = entity;
            }

            // Get events - the API endpoint is already filtered by conversation ID
            // so all events in the response belong to this conversation
            let eventEntities = [];

            // Try elements array first (main response)
            if (elements.length > 0) {
              eventEntities = elements.filter(e =>
                e['$type'] === 'com.linkedin.voyager.messaging.Event' ||
                e.eventContent
              );
              console.log('[Content Script] Using elements array:', eventEntities.length, 'events');
            }

            // Fallback: check included array for events
            if (eventEntities.length === 0) {
              eventEntities = included.filter(e =>
                e['$type'] === 'com.linkedin.voyager.messaging.Event'
              );
              console.log('[Content Script] Using included array fallback:', eventEntities.length, 'events');
            }

            const messages = [];
            for (const event of eventEntities) {
              const eventContent = event.eventContent || {};

              // New format: content is directly in eventContent, not nested
              const content = eventContent.attributedBody?.text || eventContent.body || '';
              if (!content) continue;

              // Get sender info
              const senderUrn = event['*from'] || event.from;
              const sender = entityMap[senderUrn];
              const miniProfileUrn = sender?.['*miniProfile'];
              const miniProfile = entityMap[miniProfileUrn];

              let senderName = 'Unknown';
              let isFromMe = false;

              if (miniProfile) {
                senderName = `${miniProfile.firstName || ''} ${miniProfile.lastName || ''}`.trim();
              }

              // Check if from me - multiple methods for reliability
              // Method 1: Check subtype (most reliable when available)
              if (event.subtype === 'MEMBER_TO_MEMBER_OUTBOUND') {
                isFromMe = true;
              }
              // Method 2: Check fromCurrentUser flag
              else if (event.fromCurrentUser === true) {
                isFromMe = true;
              }
              // Method 3: Check participant type in sender
              else if (sender) {
                const participantRef = sender['*messagingMember'] || sender['*participant'];
                const participant = entityMap[participantRef] || sender;
                if (participant?.participantType === 'SELF' || participant?.isSelf === true) {
                  isFromMe = true;
                }
              }

              messages.push({
                linkedin_message_id: event.entityUrn,
                content,
                is_from_me: isFromMe,
                sender_name: senderName,
                sent_at: event.createdAt ? new Date(event.createdAt).toISOString() : null
              });
            }

            // Sort by sent_at ascending (oldest first)
            messages.sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at));

            conversationMessages[conversationId] = messages;
            console.log(`[Content Script] Got ${messages.length} messages for ${conversationId}`);
          }
        } catch (e) {
          console.log(`[Content Script] Error fetching messages for ${conversationId}:`, e.message);
          conversationMessages[conversationId] = [];
        }
      }

      return conversationMessages;
    };

    fetchMessages()
      .then(conversationMessages => {
        sendResponse({ success: true, conversationMessages });
      })
      .catch(error => {
        console.error('[Content Script] Fetch messages error:', error);
        sendResponse({ success: false, error: error.message, conversationMessages: {} });
      });

    return true;
  }


  // Check for new messages — fetches recent events per conversation via REST
  if (message.type === 'CHECK_NEW_MESSAGES') {
    const checkMessages = async () => {
      const lastKnownState = message.lastKnownState || {};
      const csrfToken = getCsrfToken();
      if (!csrfToken) throw new Error('Not logged in to LinkedIn');

      const newMessages = [];
      const updatedState = { ...lastKnownState };
      const profileUrn = await getMyProfileUrn();

      // Collect conversation IDs to check
      let conversationIds = Object.keys(lastKnownState);

      // Add current conversation from URL
      const urlMatch = window.location.href.match(/\/messaging\/thread\/([^/?]+)/);
      if (urlMatch && !conversationIds.includes(urlMatch[1])) {
        conversationIds.push(urlMatch[1]);
      }

      // Add active conversations from background
      const activeConvs = message.activeConversations || [];
      for (const id of activeConvs) {
        if (id && !conversationIds.includes(id)) conversationIds.push(id);
      }

      // Add stored synced conversations
      try {
        const stored = await chrome.storage.local.get('synced_conversations');
        const storedConvs = stored.synced_conversations || [];
        for (const conv of storedConvs) {
          const id = conv.conversationId || conv.linkedin_conversation_id;
          if (id && !conversationIds.includes(id)) conversationIds.push(id);
        }
      } catch (e) { /* ignore */ }

      // Limit to 10 conversations per check to avoid rate limits
      conversationIds = conversationIds.slice(0, 10);

      if (conversationIds.length === 0) {
        return { newMessages: [], updatedState, totalChecked: 0 };
      }

      // First check intercepted data (free — no API calls needed)
      for (const conversationId of conversationIds) {
        const interceptedMsgs = interceptedData.messagesByConversation[conversationId];
        if (interceptedMsgs) {
          const lastKnownTimestamp = lastKnownState[conversationId] || 0;
          for (const msg of interceptedMsgs) {
            if (msg.timestamp > lastKnownTimestamp && !msg.isFromMe) {
              // Format to match what background.js expects
              newMessages.push({
                conversationId: msg.conversationId,
                participantName: msg.senderName || 'Unknown',
                message: {
                  content: msg.content,
                  sender_name: msg.senderName || 'Unknown',
                  timestamp: msg.timestamp,
                  sent_at: new Date(msg.timestamp).toISOString(),
                  linkedin_message_id: msg.linkedinMessageId || null,
                  is_from_me: false,
                }
              });
              if (msg.timestamp > (updatedState[conversationId] || 0)) {
                updatedState[conversationId] = msg.timestamp;
              }
            }
          }
        }
      }

      // If interceptor found new messages, return early (no API calls needed)
      if (newMessages.length > 0) {
        return { newMessages, updatedState, totalChecked: conversationIds.length, source: 'intercepted' };
      }

      // Fallback: fetch via REST for conversations not covered by interceptor
      for (const conversationId of conversationIds) {
        try {
          const response = await linkedInFetch(
            `https://www.linkedin.com/voyager/api/messaging/conversations/${conversationId}/events?count=5`,
            {
              headers: {
                'accept': 'application/vnd.linkedin.normalized+json+2.1',
                'csrf-token': csrfToken,
                'x-restli-protocol-version': '2.0.0'
              }
            }
          );

          if (!response.ok) continue;
          const data = await response.json();

          const included = data.included || [];
          const lastKnownTimestamp = lastKnownState[conversationId] || 0;

          // Find message events
          for (const entity of included) {
            const isMessage = entity.$type?.includes('MessagingMessage') ||
                              entity.$type?.includes('Event') ||
                              entity.body?.text;
            if (!isMessage || !entity.body?.text) continue;

            const timestamp = entity.createdAt || entity.deliveredAt || 0;
            if (timestamp <= lastKnownTimestamp) continue;

            // Check if this is from the other person (not us)
            const senderUrn = entity['*sender'] || entity.sender?.entityUrn || '';
            const isFromMe = profileUrn && senderUrn.includes(profileUrn.split(':').pop());
            if (isFromMe) continue;

            const subtype = entity.subtype || entity.eventContent?.['com.linkedin.voyager.messaging.event.MessageEvent']?.subtype || '';
            if (subtype.includes('OUTBOUND')) continue;

            // Format matches what background.js expects: { conversationId, participantName, message: {...} }
            newMessages.push({
              conversationId,
              participantName: entity.sender?.name || 'Unknown',
              message: {
                content: entity.body.text,
                sender_name: entity.sender?.name || 'Unknown',
                timestamp: timestamp,
                sent_at: new Date(timestamp).toISOString(),
                linkedin_message_id: entity.entityUrn || entity.backendUrn || null,
                is_from_me: false,
              }
            });

            // Update state to latest timestamp
            if (timestamp > (updatedState[conversationId] || 0)) {
              updatedState[conversationId] = timestamp;
            }
          }
        } catch (e) {
          // Skip failed conversations silently
        }
      }

      return { newMessages, updatedState, totalChecked: conversationIds.length };
    };

    checkMessages()
      .then(result => sendResponse({ success: true, ...result }))
      .catch(error => {
        sendResponse({ success: false, error: error.message, newMessages: [], updatedState: {} });
      });

    return true;
  }


  // Get current user profile URL (for account verification)
  if (message.type === 'GET_CURRENT_USER') {
    if (typeof window.ActionExecutor !== 'undefined') {
      window.ActionExecutor.getCurrentUserProfileUrl()
        .then(profileUrl => {
          sendResponse({ success: true, profileUrl });
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message });
        });
    } else {
      sendResponse({ success: false, error: 'Action executor not loaded' });
    }

    return true;
  }
});

/**
 * Handle extraction request
 * @param {number} limit - Maximum number of profiles to extract
 * @returns {Promise<object>} Extraction result
 */
async function handleExtraction(limit) {
  console.log(`[Content Script] Starting extraction with limit: ${limit}`);

  try {
    // Check if we're on a supported LinkedIn page
    if (!isSearchResultsPage()) {
      throw new Error('Please navigate to a LinkedIn Search Results or My Connections page');
    }

    // Check if selectors are loaded
    if (typeof window.LINKEDIN_SELECTORS === 'undefined') {
      throw new Error('LinkedIn selectors not loaded. Please refresh the page.');
    }

    // Check if extractor service is loaded
    if (typeof performExtraction !== 'function') {
      throw new Error('Extractor service not loaded. Please refresh the page.');
    }

    // Perform extraction
    const prospects = await performExtraction(limit);

    console.log(`[Content Script] Extraction complete: ${prospects.length} prospects`);

    return {
      success: true,
      prospects: prospects,
      count: prospects.length
    };
  } catch (error) {
    console.error('[Content Script] Extraction failed:', error);

    return {
      success: false,
      error: error.message || 'Unknown error occurred'
    };
  }
}

/**
 * Check if current page is a valid extraction page
 * Supports: Search Results, My Connections
 * @returns {boolean} True if on a supported page
 */
function isSearchResultsPage() {
  const url = window.location.href;

  // Check if URL matches supported patterns
  // LinkedIn uses both /search/results/people and /flagship-web/search/results/people
  const isSearchPage = url.includes('search/results/people');
  const isConnectionsPage = url.includes('linkedin.com/mynetwork/invite-connect/connections');

  const isValidPage = isSearchPage || isConnectionsPage;

  if (!isValidPage) {
    console.warn('[Content Script] Not on a supported extraction page. Current URL:', url);
    console.log('[Content Script] Supported pages: Search Results, My Connections');
  } else {
    console.log('[Content Script] Valid extraction page detected:', isSearchPage ? 'Search Results' : 'My Connections');
  }

  return isValidPage;
}

/**
 * Check if page has loaded search results
 * @returns {boolean} True if results are present
 */
function hasSearchResults() {
  if (!window.LINKEDIN_SELECTORS) {
    return false;
  }

  const resultsContainer = document.querySelector(
    window.LINKEDIN_SELECTORS.SEARCH.RESULTS_CONTAINER
  );

  return resultsContainer !== null;
}

// Log when content script is fully initialized
console.log('[Content Script] Initialization complete');
console.log('[Content Script] Is search page:', isSearchResultsPage());
console.log('[Content Script] Has results:', hasSearchResults());
