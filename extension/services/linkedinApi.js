/**
 * LinkedIn Voyager API Service
 *
 * Direct API calls to LinkedIn's internal Voyager API.
 * Much more reliable than DOM manipulation.
 */

const LinkedInAPI = {
  baseUrl: 'https://www.linkedin.com/voyager/api',

  // GraphQL query IDs (from Waalaxy reverse engineering)
  graphqlQueries: {
    // Fetch conversations list
    conversations: 'voyagerMessagingDashMessengerConversations.58f000d802f3d66a99c09d8ad7f5544b',
    // Fetch messages from a conversation
    messages: 'voyagerMessagingDashMessengerMessages.c7d0ab7f4b411aa8a849fbf8b210facc',
    // Fetch single conversation details
    conversationDetails: 'voyagerMessagingDashMessengerConversations.031cb3e809ed9a7f6d4b1782e0a18468',
  },

  // Cached tokens
  _csrfToken: null,
  _cookies: null,
  _profileUrn: null,

  /**
   * Get CSRF token from cookies
   * @returns {Promise<string|null>}
   */
  async getCsrfToken() {
    if (this._csrfToken) {
      return this._csrfToken;
    }

    try {
      // Get CSRF token from LinkedIn cookies
      const cookies = await chrome.cookies.getAll({ domain: '.linkedin.com' });
      const jsessionCookie = cookies.find(c => c.name === 'JSESSIONID');

      if (jsessionCookie) {
        // CSRF token is the JSESSIONID value without quotes
        this._csrfToken = jsessionCookie.value.replace(/"/g, '');
        console.log('[LinkedInAPI] CSRF token obtained');
        return this._csrfToken;
      }

      console.error('[LinkedInAPI] JSESSIONID cookie not found');
      return null;
    } catch (error) {
      console.error('[LinkedInAPI] Error getting CSRF token:', error);
      return null;
    }
  },

  /**
   * Check if user is logged into LinkedIn
   * @returns {Promise<boolean>}
   */
  async isLoggedIn() {
    try {
      const cookies = await chrome.cookies.getAll({ domain: '.linkedin.com' });
      const liAt = cookies.find(c => c.name === 'li_at');
      return !!liAt;
    } catch (error) {
      console.error('[LinkedInAPI] Error checking login status:', error);
      return false;
    }
  },

  // ==================== GRAPHQL API METHODS (Waalaxy-style) ====================

  /**
   * Fetch conversations using LinkedIn's GraphQL API (more reliable)
   * @param {number} count - Number of conversations to fetch
   * @returns {Promise<Array>}
   */
  async getConversationsGraphQL(count = 20) {
    console.log('[LinkedInAPI] Fetching conversations via GraphQL...');

    const csrfToken = await this.getCsrfToken();
    if (!csrfToken) {
      throw new Error('Not authenticated with LinkedIn');
    }

    // Get profile URN for mailbox
    const profileUrn = await this.getMyProfileUrn();
    console.log('[LinkedInAPI] Using profile URN:', profileUrn);

    // Build GraphQL URL (Waalaxy format)
    const queryId = this.graphqlQueries.conversations;
    const variables = `(categories:List(PRIMARY_INBOX,INBOX),count:${count},mailboxUrn:${encodeURIComponent(profileUrn)})`;
    const url = `${this.baseUrl}/voyagerMessagingGraphQL/graphql?queryId=${queryId}&variables=${variables}`;

    console.log('[LinkedInAPI] GraphQL URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'accept': 'application/vnd.linkedin.normalized+json+2.1',
        'csrf-token': csrfToken,
        'x-restli-protocol-version': '2.0.0',
      },
      credentials: 'include'
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[LinkedInAPI] GraphQL error:', response.status, errorText.substring(0, 200));
      throw new Error(`GraphQL error ${response.status}`);
    }

    const data = await response.json();
    console.log('[LinkedInAPI] GraphQL response received');

    return this.parseGraphQLConversations(data, profileUrn);
  },

  /**
   * Parse GraphQL conversations response
   * @param {object} data - GraphQL response
   * @param {string} myProfileUrn - Current user's profile URN
   * @returns {Array}
   */
  parseGraphQLConversations(data, myProfileUrn) {
    const conversations = [];
    const included = data.included || [];

    // Build entity map
    const entityMap = {};
    for (const entity of included) {
      if (entity.entityUrn) {
        entityMap[entity.entityUrn] = entity;
      }
      if (entity['$id']) {
        entityMap[entity['$id']] = entity;
      }
    }

    // Find conversation entities
    for (const entity of included) {
      if (entity['$type'] === 'com.linkedin.voyager.dash.messaging.MessengerConversation' ||
          entity.entityUrn?.includes('msg_conversation')) {

        try {
          // Extract conversation ID from URN
          // Format: urn:li:msg_conversation:(urn:li:fsd_profile:xxx,2-conversationId)
          const convUrn = entity.entityUrn || '';
          const convIdMatch = convUrn.match(/,([^)]+)\)/);
          const conversationId = convIdMatch ? convIdMatch[1] : null;

          if (!conversationId) continue;

          // Get participants (filter out self)
          let participantName = 'Unknown';
          let participantLinkedinId = null;
          let participantProfileUrl = null;
          let participantAvatarUrl = null;

          const participants = entity['*participants'] || entity.participants || [];
          for (const pRef of participants) {
            const participant = entityMap[pRef] || entityMap[pRef?.replace('urn:li:msg_messagingParticipant:', '')] ;

            if (participant) {
              const profileRef = participant['*profile'] || participant.profile;
              const profile = entityMap[profileRef];

              if (profile && profile.entityUrn !== myProfileUrn) {
                participantName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Unknown';
                participantLinkedinId = profile.publicIdentifier;
                participantProfileUrl = participantLinkedinId ? `https://www.linkedin.com/in/${participantLinkedinId}/` : null;

                // Get avatar
                const picture = profile.profilePicture || profile.picture;
                if (picture?.displayImageReference?.vectorImage) {
                  const img = picture.displayImageReference.vectorImage;
                  if (img.rootUrl && img.artifacts?.length) {
                    participantAvatarUrl = img.rootUrl + img.artifacts[img.artifacts.length - 1].fileIdentifyingUrlPathSegment;
                  }
                }
                break;
              }
            }
          }

          // Get last activity
          const lastActivityAt = entity.lastActivityAt;
          const unreadCount = entity.unreadCount || 0;

          conversations.push({
            linkedin_conversation_id: conversationId,
            participant_name: participantName,
            participant_linkedin_id: participantLinkedinId,
            participant_profile_url: participantProfileUrl,
            participant_avatar_url: participantAvatarUrl,
            last_message_at: lastActivityAt ? new Date(lastActivityAt).toISOString() : null,
            is_unread: unreadCount > 0,
            unread_count: unreadCount,
          });
        } catch (e) {
          console.error('[LinkedInAPI] Error parsing conversation:', e);
        }
      }
    }

    console.log(`[LinkedInAPI] Parsed ${conversations.length} conversations from GraphQL`);
    return conversations;
  },

  /**
   * Fetch messages for a conversation using GraphQL
   * @param {string} conversationId - Conversation ID
   * @param {number} count - Number of messages
   * @returns {Promise<Array>}
   */
  async getMessagesGraphQL(conversationId, count = 20) {
    console.log('[LinkedInAPI] Fetching messages via GraphQL for:', conversationId);

    const csrfToken = await this.getCsrfToken();
    if (!csrfToken) {
      throw new Error('Not authenticated with LinkedIn');
    }

    const profileUrn = await this.getMyProfileUrn();

    // Build conversation URN
    const conversationUrn = `urn:li:msg_conversation:(${profileUrn},${conversationId})`;

    // Build GraphQL URL
    const queryId = this.graphqlQueries.messages;
    const variables = `(deliveredAt:${Date.now()},conversationUrn:${encodeURIComponent(conversationUrn)},countBefore:${count},countAfter:0)`;
    const url = `${this.baseUrl}/voyagerMessagingGraphQL/graphql?queryId=${queryId}&variables=${variables}`;

    console.log('[LinkedInAPI] Messages GraphQL URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'accept': 'application/vnd.linkedin.normalized+json+2.1',
        'csrf-token': csrfToken,
        'x-restli-protocol-version': '2.0.0',
      },
      credentials: 'include'
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[LinkedInAPI] Messages GraphQL error:', response.status, errorText.substring(0, 200));
      throw new Error(`Messages GraphQL error ${response.status}`);
    }

    const data = await response.json();
    return this.parseGraphQLMessages(data, profileUrn);
  },

  /**
   * Parse GraphQL messages response
   * @param {object} data - GraphQL response
   * @param {string} myProfileUrn - Current user's profile URN
   * @returns {Array}
   */
  parseGraphQLMessages(data, myProfileUrn) {
    const messages = [];
    const included = data.included || [];

    // Build entity map
    const entityMap = {};
    for (const entity of included) {
      if (entity.entityUrn) {
        entityMap[entity.entityUrn] = entity;
      }
    }

    // Find message entities
    for (const entity of included) {
      if (entity['$type'] === 'com.linkedin.voyager.dash.messaging.MessengerMessage' ||
          entity.entityUrn?.includes('msg_message')) {

        try {
          const messageUrn = entity.entityUrn || '';
          const content = entity.body?.text || '';
          const createdAt = entity.deliveredAt || entity.createdAt;

          // Get sender info
          const senderUrn = entity.sender?.entityUrn || entity['*sender'];
          const sender = entityMap[senderUrn] || entity.sender;

          let senderName = 'Unknown';
          let senderLinkedinId = null;
          let senderProfileUrn = null;

          if (sender) {
            const profileRef = sender['*profile'] || sender.profile;
            const profile = entityMap[profileRef] || sender;
            if (profile) {
              senderName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Unknown';
              senderLinkedinId = profile.publicIdentifier;
              senderProfileUrn = profile.entityUrn;
            }
          }

          // Determine if from me - compare profile URNs directly or extract IDs
          let isFromMe = false;
          if (myProfileUrn && senderProfileUrn) {
            // Direct URN comparison
            isFromMe = senderProfileUrn === myProfileUrn;
          } else if (myProfileUrn && senderUrn) {
            // Fallback: extract fsd_profile ID and compare
            const myIdMatch = myProfileUrn.match(/fsd_profile:([^,)\s]+)/);
            const senderIdMatch = senderUrn.match(/fsd_profile:([^,)\s]+)/) ||
                                  senderProfileUrn?.match(/fsd_profile:([^,)\s]+)/);
            if (myIdMatch && senderIdMatch) {
              isFromMe = myIdMatch[1] === senderIdMatch[1];
            }
          }

          messages.push({
            linkedin_message_id: messageUrn,
            content: content,
            is_from_me: isFromMe,
            sender_name: senderName,
            sender_linkedin_id: senderLinkedinId,
            sent_at: createdAt ? new Date(createdAt).toISOString() : null,
          });
        } catch (e) {
          console.error('[LinkedInAPI] Error parsing message:', e);
        }
      }
    }

    // Sort oldest first
    messages.sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at));

    console.log(`[LinkedInAPI] Parsed ${messages.length} messages from GraphQL`);
    return messages;
  },

  /**
   * Make authenticated request to LinkedIn API
   * @param {string} endpoint - API endpoint
   * @param {string} method - HTTP method
   * @param {object|null} body - Request body
   * @param {object} extraHeaders - Additional headers
   * @returns {Promise<object>}
   */
  async request(endpoint, method = 'GET', body = null, extraHeaders = {}) {
    const csrfToken = await this.getCsrfToken();

    if (!csrfToken) {
      throw new Error('Not authenticated with LinkedIn. Please log in to LinkedIn first.');
    }

    const url = `${this.baseUrl}${endpoint}`;

    const headers = {
      'accept': 'application/vnd.linkedin.normalized+json+2.1',
      'csrf-token': csrfToken,
      'x-restli-protocol-version': '2.0.0',
      'x-li-lang': 'en_US',
      'x-li-page-instance': 'urn:li:page:messaging_thread;' + Math.random().toString(36).substring(7),
      'x-li-track': JSON.stringify({
        clientVersion: '1.13.8',
        mpVersion: '1.13.8',
        osName: 'web',
        timezoneOffset: new Date().getTimezoneOffset()
      }),
      ...extraHeaders
    };

    if (body) {
      headers['content-type'] = 'application/json; charset=UTF-8';
    }

    const options = {
      method,
      headers,
      credentials: 'include', // Include cookies
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(body);
    }

    console.log('[LinkedInAPI] Request:', method, url);
    console.log('[LinkedInAPI] Body:', body);

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[LinkedInAPI] Error response:', response.status, errorText);
        // Parse error for more details
        let errorMessage = `LinkedIn API error: ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.message) {
            errorMessage = errorJson.message;
          }
        } catch (e) {
          // Not JSON, use the text
          if (errorText.length < 200) {
            errorMessage = errorText;
          }
        }
        const error = new Error(errorMessage);
        error.status = response.status;
        error.details = errorText;
        throw error;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[LinkedInAPI] Request failed:', error);
      throw error;
    }
  },

  /**
   * Get list of conversations
   * @param {number} count - Number of conversations to fetch
   * @returns {Promise<Array>}
   */
  async getConversations(count = 50) {
    console.log('[LinkedInAPI] Fetching conversations...');

    const csrfToken = await this.getCsrfToken();

    // Use the new voyagerMessagingDash endpoint
    const endpoint = `${this.baseUrl}/voyagerMessagingDashMessengerConversations?decorationId=com.linkedin.voyager.dash.deco.messaging.FullConversation-67&q=search&count=${count}`;

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'accept': 'application/vnd.linkedin.normalized+json+2.1',
          'csrf-token': csrfToken,
          'x-restli-protocol-version': '2.0.0'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        // Fallback to old endpoint
        console.log('[LinkedInAPI] New endpoint failed, trying legacy...');
        const legacyResponse = await this.request(`/messaging/conversations?keyVersion=LEGACY_INBOX&q=syncToken&count=${count}`);
        const conversations = this.parseConversationsResponse(legacyResponse);
        console.log(`[LinkedInAPI] Fetched ${conversations.length} conversations (legacy)`);
        return conversations;
      }

      const data = await response.json();
      console.log('[LinkedInAPI] Raw conversations response:', JSON.stringify(data).substring(0, 500));

      // Parse the new format
      const conversations = this.parseNewConversationsResponse(data);
      console.log(`[LinkedInAPI] Fetched ${conversations.length} conversations`);

      return conversations;
    } catch (error) {
      console.error('[LinkedInAPI] Failed to fetch conversations:', error);
      throw error;
    }
  },

  /**
   * Parse new voyagerMessagingDash conversation response
   * @param {object} response - Raw API response
   * @returns {Array}
   */
  parseNewConversationsResponse(response) {
    const conversations = [];
    const included = response.included || [];
    const elements = response.data?.elements || response.elements || [];

    console.log('[LinkedInAPI] Parsing - elements:', elements.length, 'included:', included.length);

    // Create lookup maps for included entities
    const entityMap = {};
    for (const entity of included) {
      if (entity.entityUrn) {
        entityMap[entity.entityUrn] = entity;
      }
      // Also map by $id if present
      if (entity['$id']) {
        entityMap[entity['$id']] = entity;
      }
    }

    // Process each conversation element
    for (const element of elements) {
      try {
        // Get conversation URN - new format uses different field names
        const conversationUrn = element.entityUrn || element.backendUrn || element['*conversation'];
        let conversationId = null;

        // Extract ID from various URN formats
        if (conversationUrn) {
          // Format: urn:li:msg_conversation:(urn:li:fsd_profile:xxx,2-xxx)
          const match = conversationUrn.match(/,([^)]+)\)/) || conversationUrn.match(/messagingThread:(.+)/);
          if (match) {
            conversationId = match[1];
          } else {
            conversationId = this.extractIdFromUrn(conversationUrn);
          }
        }

        if (!conversationId) {
          console.log('[LinkedInAPI] Could not extract conversation ID from:', conversationUrn);
          continue;
        }

        // Get participant info from the conversation
        let participantName = 'Unknown';
        let participantProfileUrl = null;
        let participantAvatarUrl = null;
        let participantLinkedinId = null;

        // New format has participants differently
        const participantUrns = element['*participants'] || element.participants || [];
        for (const pUrn of participantUrns) {
          const participant = entityMap[pUrn];
          if (participant) {
            // Get the profile from participant
            const profileUrn = participant['*profile'] || participant.profile;
            const profile = entityMap[profileUrn] || participant;

            if (profile) {
              participantName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || profile.name || 'Unknown';
              participantLinkedinId = profile.publicIdentifier;
              participantProfileUrl = participantLinkedinId
                ? `https://www.linkedin.com/in/${participantLinkedinId}/`
                : null;

              // Get avatar from profile picture
              const picture = profile.profilePicture || profile.picture;
              if (picture) {
                const displayImage = picture.displayImageReference?.vectorImage;
                if (displayImage?.rootUrl && displayImage?.artifacts?.length) {
                  const artifact = displayImage.artifacts[displayImage.artifacts.length - 1];
                  participantAvatarUrl = displayImage.rootUrl + artifact.fileIdentifyingUrlPathSegment;
                }
              }
              break;
            }
          }
        }

        // Get last message info
        const lastActivityAt = element.lastActivityAt;
        const unreadCount = element.unreadCount || 0;

        // Get last message preview
        let lastMessagePreview = null;
        const lastMessage = element.lastMessage || element['*lastMessage'];
        if (lastMessage) {
          const msg = typeof lastMessage === 'string' ? entityMap[lastMessage] : lastMessage;
          if (msg?.body?.text) {
            lastMessagePreview = msg.body.text;
          }
        }

        conversations.push({
          linkedin_conversation_id: conversationId,
          participant_name: participantName,
          participant_linkedin_id: participantLinkedinId,
          participant_profile_url: participantProfileUrl,
          participant_avatar_url: participantAvatarUrl,
          last_message_preview: lastMessagePreview,
          last_message_at: lastActivityAt ? new Date(lastActivityAt).toISOString() : null,
          is_unread: unreadCount > 0,
          unread_count: unreadCount,
        });
      } catch (error) {
        console.error('[LinkedInAPI] Error parsing conversation:', error);
      }
    }

    return conversations;
  },

  /**
   * Parse LinkedIn's normalized conversation response
   * @param {object} response - Raw API response
   * @returns {Array}
   */
  parseConversationsResponse(response) {
    const conversations = [];
    const included = response.included || [];
    const elements = response.data?.elements || response.elements || [];

    // Create lookup maps for included entities
    const entityMap = {};
    for (const entity of included) {
      if (entity.entityUrn || entity['*miniProfile'] || entity.$type) {
        const urn = entity.entityUrn || entity['*miniProfile'];
        if (urn) {
          entityMap[urn] = entity;
        }
      }
    }

    // Process each conversation element
    for (const element of elements) {
      try {
        const conversationUrn = element.entityUrn || element['*elements'];
        const conversationId = this.extractIdFromUrn(conversationUrn);

        if (!conversationId) continue;

        // Get participant info
        const participants = element['*participants'] || element.participants || [];
        let participantName = 'Unknown';
        let participantProfileUrl = null;
        let participantAvatarUrl = null;
        let participantLinkedinId = null;

        for (const participantUrn of participants) {
          const participant = entityMap[participantUrn];
          if (participant) {
            const miniProfileUrn = participant['*miniProfile'];
            const miniProfile = entityMap[miniProfileUrn] || participant.miniProfile;

            if (miniProfile) {
              participantName = `${miniProfile.firstName || ''} ${miniProfile.lastName || ''}`.trim();
              participantLinkedinId = miniProfile.publicIdentifier;
              participantProfileUrl = participantLinkedinId
                ? `https://www.linkedin.com/in/${participantLinkedinId}/`
                : null;

              // Get avatar
              const picture = miniProfile.picture;
              if (picture && picture.rootUrl && picture.artifacts) {
                const artifact = picture.artifacts[picture.artifacts.length - 1];
                participantAvatarUrl = picture.rootUrl + artifact.fileIdentifyingUrlPathSegment;
              }
              break;
            }
          }
        }

        // Get last message info
        const lastActivityAt = element.lastActivityAt;
        const unreadCount = element.unreadCount || 0;

        // Get last message preview from events
        let lastMessagePreview = null;
        const eventsUrn = element['*events'];
        if (eventsUrn && eventsUrn.length > 0) {
          const lastEventUrn = eventsUrn[0];
          const lastEvent = entityMap[lastEventUrn];
          if (lastEvent && lastEvent.eventContent) {
            const messageEvent = lastEvent.eventContent['com.linkedin.voyager.messaging.event.MessageEvent'];
            if (messageEvent) {
              lastMessagePreview = messageEvent.attributedBody?.text || messageEvent.body || null;
            }
          }
        }

        conversations.push({
          linkedin_conversation_id: conversationId,
          participant_name: participantName,
          participant_linkedin_id: participantLinkedinId,
          participant_profile_url: participantProfileUrl,
          participant_avatar_url: participantAvatarUrl,
          last_message_preview: lastMessagePreview,
          last_message_at: lastActivityAt ? new Date(lastActivityAt).toISOString() : null,
          is_unread: unreadCount > 0,
          unread_count: unreadCount,
        });
      } catch (error) {
        console.error('[LinkedInAPI] Error parsing conversation:', error);
      }
    }

    return conversations;
  },

  /**
   * Get messages for a specific conversation
   * @param {string} conversationId - LinkedIn conversation ID
   * @param {number} count - Number of messages to fetch
   * @returns {Promise<Array>}
   */
  async getMessages(conversationId, count = 50) {
    console.log('[LinkedInAPI] Fetching messages for conversation:', conversationId);

    const conversationUrn = `urn:li:messagingThread:${conversationId}`;
    const endpoint = `/messaging/conversations/${encodeURIComponent(conversationUrn)}/events?q=syncToken&count=${count}`;

    try {
      const response = await this.request(endpoint);
      const messages = this.parseMessagesResponse(response);
      console.log(`[LinkedInAPI] Fetched ${messages.length} messages`);

      return messages;
    } catch (error) {
      console.error('[LinkedInAPI] Failed to fetch messages:', error);
      throw error;
    }
  },

  /**
   * Parse LinkedIn's normalized messages response
   * @param {object} response - Raw API response
   * @returns {Array}
   */
  parseMessagesResponse(response) {
    const messages = [];
    const included = response.included || [];
    const elements = response.data?.elements || response.elements || [];

    // Create lookup map
    const entityMap = {};
    for (const entity of included) {
      if (entity.entityUrn) {
        entityMap[entity.entityUrn] = entity;
      }
    }

    for (const element of elements) {
      try {
        const eventUrn = element.entityUrn;
        const messageId = this.extractIdFromUrn(eventUrn);

        if (!messageId) continue;

        const eventContent = element.eventContent || {};
        const messageEvent = eventContent['com.linkedin.voyager.messaging.event.MessageEvent'];

        if (!messageEvent) continue;

        const content = messageEvent.attributedBody?.text || messageEvent.body || '';
        const createdAt = element.createdAt;

        // Get sender info
        const senderUrn = element['*from'] || element.from;
        const sender = entityMap[senderUrn];
        const miniProfileUrn = sender?.['*miniProfile'];
        const miniProfile = entityMap[miniProfileUrn] || sender?.miniProfile;

        let senderName = 'Unknown';
        let senderLinkedinId = null;
        let isFromMe = false;

        if (miniProfile) {
          senderName = `${miniProfile.firstName || ''} ${miniProfile.lastName || ''}`.trim();
          senderLinkedinId = miniProfile.publicIdentifier;
        }

        // Determine if message is from current user
        // 'MEMBER_TO_MEMBER_OUTBOUND' = sent BY current user
        // 'MEMBER_TO_MEMBER' = any DM (NOT necessarily from me - this was a bug!)
        isFromMe = element.fromCurrentUser ?? (element.subtype === 'MEMBER_TO_MEMBER_OUTBOUND');

        messages.push({
          linkedin_message_id: messageId,
          content: content,
          is_from_me: isFromMe,
          sender_name: senderName,
          sender_linkedin_id: senderLinkedinId,
          sent_at: createdAt ? new Date(createdAt).toISOString() : null,
        });
      } catch (error) {
        console.error('[LinkedInAPI] Error parsing message:', error);
      }
    }

    // Sort by sent_at ascending (oldest first)
    messages.sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at));

    return messages;
  },

  /**
   * Send a message to a conversation
   * @param {string} conversationId - LinkedIn conversation ID
   * @param {string} content - Message content
   * @returns {Promise<object>}
   */
  async sendMessage(conversationId, content) {
    console.log('[LinkedInAPI] Sending message to conversation:', conversationId);

    const csrfToken = await this.getCsrfToken();
    if (!csrfToken) {
      throw new Error('Not authenticated with LinkedIn');
    }

    // Try multiple API formats - Method 4 is the known working format
    const methods = [
      () => this.sendMessageMethod4(conversationId, content, csrfToken),  // Primary - matches actual LinkedIn
      () => this.sendMessageMethod1(conversationId, content, csrfToken),
      () => this.sendMessageMethod2(conversationId, content, csrfToken),
      () => this.sendMessageMethod3(conversationId, content, csrfToken),
    ];

    let lastError = null;
    for (let i = 0; i < methods.length; i++) {
      try {
        console.log(`[LinkedInAPI] Trying method ${i + 1}...`);
        const result = await methods[i]();
        console.log(`[LinkedInAPI] Method ${i + 1} succeeded!`);
        return result;
      } catch (error) {
        console.log(`[LinkedInAPI] Method ${i + 1} failed:`, error.message);
        lastError = error;
      }
    }

    throw lastError || new Error('All send methods failed');
  },

  /**
   * Method 1: Standard events endpoint
   */
  async sendMessageMethod1(conversationId, content, csrfToken) {
    const conversationUrn = `urn:li:messagingThread:${conversationId}`;
    const endpoint = `${this.baseUrl}/messaging/conversations/${encodeURIComponent(conversationUrn)}/events`;

    const body = {
      eventCreate: {
        value: {
          'com.linkedin.voyager.messaging.create.MessageCreate': {
            body: content,
            attachments: [],
            attributedBody: {
              text: content,
              attributes: []
            },
            mediaAttachments: []
          }
        }
      },
      dedupeByClientGeneratedToken: false
    };

    return await this.doSendRequest(endpoint, body, csrfToken);
  },

  /**
   * Method 2: With action=create query param
   */
  async sendMessageMethod2(conversationId, content, csrfToken) {
    const conversationUrn = `urn:li:messagingThread:${conversationId}`;
    const endpoint = `${this.baseUrl}/messaging/conversations/${encodeURIComponent(conversationUrn)}/events?action=create`;

    const body = {
      eventCreate: {
        originToken: this.generateUUID(),
        value: {
          'com.linkedin.voyager.messaging.create.MessageCreate': {
            body: content,
            attachments: [],
            attributedBody: {
              text: content,
              attributes: []
            }
          }
        },
        trackingId: this.generateTrackingId()
      },
      dedupeByClientGeneratedToken: false
    };

    return await this.doSendRequest(endpoint, body, csrfToken);
  },

  /**
   * Method 3: Simple body format
   */
  async sendMessageMethod3(conversationId, content, csrfToken) {
    const conversationUrn = `urn:li:messagingThread:${conversationId}`;
    const endpoint = `${this.baseUrl}/messaging/conversations/${encodeURIComponent(conversationUrn)}/events`;

    // Simpler body format
    const body = {
      eventCreate: {
        value: {
          'com.linkedin.voyager.messaging.create.MessageCreate': {
            body: content
          }
        }
      }
    };

    return await this.doSendRequest(endpoint, body, csrfToken);
  },

  /**
   * Method 4: Using the actual LinkedIn endpoint (voyagerMessagingDashMessengerMessages)
   * This matches the exact format LinkedIn uses
   */
  async sendMessageMethod4(conversationId, content, csrfToken) {
    const endpoint = `${this.baseUrl}/voyagerMessagingDashMessengerMessages?action=createMessage`;

    // Get the user's profile URN
    const profileUrn = await this.getMyProfileUrn();
    console.log('[LinkedInAPI] Profile URN:', profileUrn);

    // Build the exact body format LinkedIn uses
    const body = {
      dedupeByClientGeneratedToken: false,
      mailboxUrn: profileUrn,
      message: {
        body: {
          attributes: [],
          text: content
        },
        conversationUrn: `urn:li:msg_conversation:(${profileUrn},${conversationId})`,
        originToken: this.generateUUID(),
        renderContentUnions: []
      },
      trackingId: this.generateTrackingId()
    };

    console.log('[LinkedInAPI] Method 4 - voyagerMessagingDashMessengerMessages');

    // Use the exact headers LinkedIn uses
    const headers = {
      'accept': 'application/json',
      'content-type': 'text/plain;charset=UTF-8',
      'csrf-token': csrfToken,
      'x-li-lang': 'en_US',
      'x-li-page-instance': `urn:li:page:d_flagship3_messaging_conversation_detail;${this.generateBase64Id()}`,
      'x-li-track': JSON.stringify({
        clientVersion: '1.13.41695',
        mpVersion: '1.13.41695',
        osName: 'web',
        timezoneOffset: 5,
        timezone: 'Asia/Karachi',
        deviceFormFactor: 'DESKTOP',
        mpName: 'voyager-web',
        displayDensity: 2,
        displayWidth: 2940,
        displayHeight: 1912
      }),
      'x-restli-protocol-version': '2.0.0'
    };

    console.log('[LinkedInAPI] Endpoint:', endpoint);
    console.log('[LinkedInAPI] Body:', JSON.stringify(body));

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      credentials: 'include'
    });

    const responseText = await response.text();
    console.log('[LinkedInAPI] Response status:', response.status);
    console.log('[LinkedInAPI] Response:', responseText.substring(0, 500));

    if (!response.ok) {
      throw new Error(`API error ${response.status}: ${responseText.substring(0, 200)}`);
    }

    const data = JSON.parse(responseText);
    return {
      success: true,
      messageId: data?.value?.entityUrn || data?.data?.value?.entityUrn || null,
      response: data
    };
  },

  /**
   * Get current user's profile URN
   */
  async getMyProfileUrn() {
    // First check if we have it cached
    if (this._profileUrn) {
      return this._profileUrn;
    }

    const csrfToken = await this.getCsrfToken();

    // Method 1: Try voyagerMessagingDashMessengerConversations to get current user from participants
    try {
      console.log('[LinkedInAPI] Trying to get profile from conversations...');
      const endpoint = `${this.baseUrl}/voyagerMessagingDashMessengerConversations?decorationId=com.linkedin.voyager.dash.deco.messaging.FullConversation-67&q=search&count=1`;

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'accept': 'application/vnd.linkedin.normalized+json+2.1',
          'csrf-token': csrfToken,
          'x-restli-protocol-version': '2.0.0'
        },
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        // Look for fsd_profile in included entities
        if (data?.included) {
          for (const entity of data.included) {
            if (entity.entityUrn?.startsWith('urn:li:fsd_profile:')) {
              // We need to find which one is "me" - typically the one that appears in mailbox
              this._profileUrn = entity.entityUrn;
              console.log('[LinkedInAPI] Found profile URN from conversations:', this._profileUrn);
              return this._profileUrn;
            }
          }
        }
      }
    } catch (e) {
      console.log('[LinkedInAPI] Could not get profile from conversations:', e.message);
    }

    // Method 2: Try the messaging mailbox endpoint
    try {
      console.log('[LinkedInAPI] Trying to get profile from mailbox...');
      const endpoint = `${this.baseUrl}/voyagerMessagingDashMessengerMailbox`;

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'accept': 'application/vnd.linkedin.normalized+json+2.1',
          'csrf-token': csrfToken,
          'x-restli-protocol-version': '2.0.0'
        },
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        // The mailbox should contain the current user's profile URN
        if (data?.data?.entityUrn) {
          const match = data.data.entityUrn.match(/urn:li:fsd_profile:([^,)]+)/);
          if (match) {
            this._profileUrn = `urn:li:fsd_profile:${match[1]}`;
            console.log('[LinkedInAPI] Found profile URN from mailbox:', this._profileUrn);
            return this._profileUrn;
          }
        }
        // Also check included
        if (data?.included) {
          for (const entity of data.included) {
            if (entity.entityUrn?.startsWith('urn:li:fsd_profile:')) {
              this._profileUrn = entity.entityUrn;
              console.log('[LinkedInAPI] Found profile URN from mailbox included:', this._profileUrn);
              return this._profileUrn;
            }
          }
        }
      }
    } catch (e) {
      console.log('[LinkedInAPI] Could not get profile from mailbox:', e.message);
    }

    // Method 3: Try voyagerIdentityDashProfiles
    try {
      console.log('[LinkedInAPI] Trying voyagerIdentityDashProfiles...');
      const endpoint = `${this.baseUrl}/voyagerIdentityDashProfiles?q=memberIdentity&memberIdentity=me`;

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'accept': 'application/vnd.linkedin.normalized+json+2.1',
          'csrf-token': csrfToken,
          'x-restli-protocol-version': '2.0.0'
        },
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data?.included) {
          for (const entity of data.included) {
            if (entity.entityUrn?.startsWith('urn:li:fsd_profile:')) {
              this._profileUrn = entity.entityUrn;
              console.log('[LinkedInAPI] Found profile URN from identity:', this._profileUrn);
              return this._profileUrn;
            }
          }
        }
      }
    } catch (e) {
      console.log('[LinkedInAPI] Could not get profile from identity:', e.message);
    }

    throw new Error('Could not determine your LinkedIn profile. Please refresh LinkedIn and try again.');
  },

  /**
   * Generate base64-like ID for page instance
   */
  generateBase64Id() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    for (let i = 0; i < 22; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result + '==';
  },

  /**
   * Get current member ID from cookie or API
   */
  async getCurrentMemberId() {
    try {
      const cookies = await chrome.cookies.getAll({ domain: '.linkedin.com' });
      // Try to get member ID from various cookies
      for (const cookie of cookies) {
        if (cookie.name === 'li_mc') {
          // li_mc contains member cluster info
          const match = cookie.value.match(/member:(\d+)/);
          if (match) return match[1];
        }
      }
      // Default - this won't work but allows the request to proceed for error info
      return 'unknown';
    } catch (e) {
      return 'unknown';
    }
  },

  /**
   * Execute send request with proper headers matching LinkedIn's actual format
   */
  async doSendRequest(endpoint, body, csrfToken) {
    console.log('[LinkedInAPI] Endpoint:', endpoint);
    console.log('[LinkedInAPI] Body:', JSON.stringify(body).substring(0, 500));

    // Use headers that match LinkedIn's actual requests
    const headers = {
      'accept': 'application/vnd.linkedin.normalized+json+2.1',
      'content-type': 'application/json; charset=UTF-8',
      'csrf-token': csrfToken,
      'x-restli-protocol-version': '2.0.0',
      'x-li-lang': 'en_US',
      'x-li-track': JSON.stringify({
        clientVersion: '1.13.41695',
        mpVersion: '1.13.41695',
        osName: 'web',
        timezoneOffset: -new Date().getTimezoneOffset(), // LinkedIn uses positive for east
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        deviceFormFactor: 'DESKTOP',
        mpName: 'voyager-web',
        displayDensity: 2,
        displayWidth: 2940,
        displayHeight: 1912
      }),
      'x-li-page-instance': `urn:li:page:messaging_thread;${this.generateUUID()}`
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      credentials: 'include'
    });

    const responseText = await response.text();
    console.log('[LinkedInAPI] Response status:', response.status);
    console.log('[LinkedInAPI] Response:', responseText.substring(0, 500));

    if (!response.ok) {
      throw new Error(`API error ${response.status}: ${responseText.substring(0, 200)}`);
    }

    const data = JSON.parse(responseText);
    return {
      success: true,
      messageId: data?.value?.entityUrn || data?.data?.value?.entityUrn || null,
      response: data
    };
  },

  /**
   * Generate a UUID for tracking
   * @returns {string}
   */
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  /**
   * Generate a tracking ID for message deduplication
   * @returns {string}
   */
  generateTrackingId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result + '==';
  },

  /**
   * Mark a conversation as read
   * @param {string} conversationId - LinkedIn conversation ID
   * @returns {Promise<object>}
   */
  async markAsRead(conversationId) {
    console.log('[LinkedInAPI] Marking conversation as read:', conversationId);

    const conversationUrn = `urn:li:messagingThread:${conversationId}`;
    const endpoint = `/messaging/conversations/${encodeURIComponent(conversationUrn)}`;

    const body = {
      patch: {
        $set: {
          read: true
        }
      }
    };

    try {
      await this.request(endpoint, 'POST', body);
      console.log('[LinkedInAPI] Conversation marked as read');
      return { success: true };
    } catch (error) {
      console.error('[LinkedInAPI] Failed to mark as read:', error);
      throw error;
    }
  },

  /**
   * Get current user's profile info
   * @returns {Promise<object>}
   */
  async getCurrentUser() {
    console.log('[LinkedInAPI] Fetching current user...');

    const endpoint = '/me';

    try {
      const response = await this.request(endpoint);
      return response;
    } catch (error) {
      console.error('[LinkedInAPI] Failed to fetch current user:', error);
      throw error;
    }
  },

  /**
   * Extract ID from LinkedIn URN
   * @param {string} urn - LinkedIn URN (e.g., "urn:li:messagingThread:2-abc123")
   * @returns {string|null}
   */
  extractIdFromUrn(urn) {
    if (!urn) return null;

    // Handle different URN formats
    // urn:li:messagingThread:2-abc123
    // urn:li:fs_event:(2-abc123,123456789)
    const match = urn.match(/urn:li:[^:]+:(.+)/);
    if (match) {
      // Remove parentheses and take first part if comma-separated
      let id = match[1].replace(/[()]/g, '');
      if (id.includes(',')) {
        id = id.split(',')[0];
      }
      return id;
    }

    return urn;
  },

  /**
   * Clear cached tokens (call when user logs out)
   */
  clearCache() {
    this._csrfToken = null;
    this._cookies = null;
  }
};

// Export for use in background script
if (typeof window !== 'undefined') {
  window.LinkedInAPI = LinkedInAPI;
}

// For service worker context
if (typeof self !== 'undefined') {
  self.LinkedInAPI = LinkedInAPI;
}
