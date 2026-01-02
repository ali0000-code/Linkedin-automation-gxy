/**
 * Debug script - paste this in LinkedIn tab console to test message fetching
 */

(async function debugMessagePolling() {
  console.log('=== DEBUG: Message Polling Test ===\n');

  // Step 1: Check CSRF token
  const getCsrfToken = () => {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'JSESSIONID') {
        return value.replace(/"/g, '');
      }
    }
    return null;
  };

  const csrfToken = getCsrfToken();
  console.log('1. CSRF Token:', csrfToken ? '✓ Found' : '✗ NOT FOUND');

  if (!csrfToken) {
    console.error('ERROR: Not logged in to LinkedIn');
    return;
  }

  // Step 2: Test conversations API
  console.log('\n2. Testing Conversations API...');

  try {
    const convResponse = await fetch(
      'https://www.linkedin.com/voyager/api/voyagerMessagingDashMessengerConversations?decorationId=com.linkedin.voyager.dash.deco.messaging.FullConversation-67&q=search&count=5',
      {
        headers: {
          'accept': 'application/vnd.linkedin.normalized+json+2.1',
          'csrf-token': csrfToken,
          'x-restli-protocol-version': '2.0.0'
        },
        credentials: 'include'
      }
    );

    console.log('   Status:', convResponse.status);

    if (!convResponse.ok) {
      const errorText = await convResponse.text();
      console.error('   ERROR:', errorText.substring(0, 500));
      return;
    }

    const convData = await convResponse.json();
    const elements = convData.data?.elements || convData.elements || [];
    const included = convData.included || [];

    console.log('   ✓ Elements:', elements.length);
    console.log('   ✓ Included entities:', included.length);

    if (elements.length === 0) {
      console.error('   ERROR: No conversations found');
      return;
    }

    // Step 3: Parse first conversation
    console.log('\n3. Parsing first conversation...');

    const firstConv = elements[0];
    console.log('   Raw element keys:', Object.keys(firstConv));

    // Extract conversation ID
    let conversationId = null;
    const urn = firstConv.backendConversationUrn || firstConv.entityUrn;
    console.log('   URN:', urn);

    if (urn) {
      const match = urn.match(/messagingThread:([^,)]+)/) || urn.match(/,([^)]+)\)/);
      if (match) conversationId = match[1];
    }

    console.log('   Conversation ID:', conversationId || 'NOT FOUND');
    console.log('   lastActivityAt:', firstConv.lastActivityAt);
    console.log('   unreadCount:', firstConv.unreadCount);

    if (!conversationId) {
      console.error('   ERROR: Could not extract conversation ID from URN');
      console.log('   Full element:', JSON.stringify(firstConv).substring(0, 1000));
      return;
    }

    // Step 4: Fetch messages for this conversation
    console.log('\n4. Testing Messages API for conversation:', conversationId);

    const msgResponse = await fetch(
      `https://www.linkedin.com/voyager/api/messaging/conversations/urn%3Ali%3AmessagingThread%3A${conversationId}/events?q=syncToken&count=5`,
      {
        headers: {
          'accept': 'application/vnd.linkedin.normalized+json+2.1',
          'csrf-token': csrfToken,
          'x-restli-protocol-version': '2.0.0'
        },
        credentials: 'include'
      }
    );

    console.log('   Status:', msgResponse.status);

    if (!msgResponse.ok) {
      const errorText = await msgResponse.text();
      console.error('   ERROR:', errorText.substring(0, 500));

      // Try alternative endpoint
      console.log('\n   Trying alternative endpoint...');
      const altResponse = await fetch(
        `https://www.linkedin.com/voyager/api/voyagerMessagingDashMessengerMessages?q=conversationUrn&conversationUrn=urn:li:messagingThread:${conversationId}&count=5`,
        {
          headers: {
            'accept': 'application/vnd.linkedin.normalized+json+2.1',
            'csrf-token': csrfToken,
            'x-restli-protocol-version': '2.0.0'
          },
          credentials: 'include'
        }
      );
      console.log('   Alt Status:', altResponse.status);
      if (altResponse.ok) {
        const altData = await altResponse.json();
        console.log('   Alt Elements:', altData.data?.elements?.length || altData.elements?.length || 0);
      }
      return;
    }

    const msgData = await msgResponse.json();
    const msgElements = msgData.data?.elements || msgData.elements || [];
    const msgIncluded = msgData.included || [];

    console.log('   ✓ Message elements:', msgElements.length);
    console.log('   ✓ Included entities:', msgIncluded.length);

    // Step 5: Parse messages
    console.log('\n5. Parsing messages...');

    for (let i = 0; i < Math.min(3, msgElements.length); i++) {
      const event = msgElements[i];
      console.log(`\n   Message ${i + 1}:`);
      console.log('   - entityUrn:', event.entityUrn);
      console.log('   - createdAt:', event.createdAt, '(' + new Date(event.createdAt).toISOString() + ')');
      console.log('   - subtype:', event.subtype);
      console.log('   - *from:', event['*from'] || event.from);

      const eventContent = event.eventContent || {};
      const messageEvent = eventContent['com.linkedin.voyager.messaging.event.MessageEvent'];

      if (messageEvent) {
        const content = messageEvent.attributedBody?.text || messageEvent.body || '';
        console.log('   - content:', content.substring(0, 100));
      } else {
        console.log('   - eventContent keys:', Object.keys(eventContent));
      }
    }

    console.log('\n=== DEBUG COMPLETE ===');
    console.log('\nIf you see messages above, the API is working.');
    console.log('If not, check the error messages.');

  } catch (error) {
    console.error('FETCH ERROR:', error);
  }
})();
