/**
 * INBOX DEBUG SCRIPT
 *
 * Run this in the LinkedIn console (DevTools > Console) while on linkedin.com/messaging/
 *
 * Usage: Copy and paste the entire script, then call the functions:
 *   - debugPhase1() - Test extension loaded
 *   - debugPhase2() - Test CSRF token & API access
 *   - debugPhase3() - Test fetching messages for current conversation
 *   - debugPhase4() - Test full sync flow
 */

console.log('='.repeat(60));
console.log('INBOX DEBUG SCRIPT LOADED');
console.log('='.repeat(60));

// ==================== PHASE 1: Extension Check ====================
window.debugPhase1 = async function() {
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 1: Checking if extension is loaded...');
  console.log('='.repeat(60));

  // Check if content script is loaded
  const contentScriptLoaded = typeof chrome !== 'undefined' && chrome.runtime;
  console.log('1. Chrome runtime available:', contentScriptLoaded ? '✅ YES' : '❌ NO');

  if (!contentScriptLoaded) {
    console.log('❌ Extension not loaded. Please:');
    console.log('   1. Go to chrome://extensions');
    console.log('   2. Reload the extension');
    console.log('   3. Hard refresh this page (Cmd+Shift+R)');
    return false;
  }

  // Try to ping the background script
  try {
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'BACKGROUND_PING' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
    console.log('2. Background script responding:', response?.success ? '✅ YES' : '❌ NO');
    console.log('   Response:', response);
  } catch (e) {
    console.log('2. Background script responding: ❌ NO');
    console.log('   Error:', e.message);
  }

  console.log('\n✅ Phase 1 complete');
  return true;
};

// ==================== PHASE 2: API Access Check ====================
window.debugPhase2 = async function() {
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 2: Checking API access...');
  console.log('='.repeat(60));

  // Get CSRF token
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
  console.log('1. CSRF Token:', csrfToken ? '✅ Found' : '❌ Not found');
  if (!csrfToken) {
    console.log('   ❌ Not logged in to LinkedIn');
    return false;
  }

  // Test Profile API
  console.log('\n2. Testing Profile API...');
  try {
    const profileResponse = await fetch('https://www.linkedin.com/voyager/api/me', {
      headers: {
        'accept': 'application/vnd.linkedin.normalized+json+2.1',
        'csrf-token': csrfToken,
        'x-restli-protocol-version': '2.0.0'
      },
      credentials: 'include'
    });
    console.log('   Status:', profileResponse.status);
    if (profileResponse.ok) {
      const data = await profileResponse.json();
      const name = data.miniProfile ?
        `${data.miniProfile.firstName} ${data.miniProfile.lastName}` :
        'Unknown';
      console.log('   ✅ Profile API works - Logged in as:', name);
    } else {
      console.log('   ❌ Profile API failed');
    }
  } catch (e) {
    console.log('   ❌ Profile API error:', e.message);
  }

  // Test Conversations API (known to be broken)
  console.log('\n3. Testing Conversations List API...');
  try {
    const convResponse = await fetch('https://www.linkedin.com/voyager/api/messaging/conversations?keyVersion=LEGACY_INBOX', {
      headers: {
        'accept': 'application/vnd.linkedin.normalized+json+2.1',
        'csrf-token': csrfToken,
        'x-restli-protocol-version': '2.0.0'
      },
      credentials: 'include'
    });
    console.log('   Status:', convResponse.status);
    if (convResponse.ok) {
      console.log('   ✅ Conversations API works');
    } else {
      console.log('   ⚠️ Conversations API returns', convResponse.status, '(this is expected - API is broken)');
    }
  } catch (e) {
    console.log('   ❌ Conversations API error:', e.message);
  }

  console.log('\n✅ Phase 2 complete');
  return csrfToken;
};

// ==================== PHASE 3: Current Conversation Messages ====================
window.debugPhase3 = async function() {
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 3: Fetching messages for current conversation...');
  console.log('='.repeat(60));

  // Get conversation ID from URL
  const urlMatch = window.location.href.match(/\/messaging\/thread\/([^/?]+)/);
  if (!urlMatch) {
    console.log('❌ Not on a conversation page');
    console.log('   Please navigate to: linkedin.com/messaging/thread/...');
    return false;
  }

  const conversationId = urlMatch[1];
  console.log('1. Conversation ID from URL:', conversationId);

  // Get CSRF token
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
  if (!csrfToken) {
    console.log('❌ No CSRF token');
    return false;
  }

  // Fetch messages
  console.log('\n2. Fetching messages...');
  try {
    const response = await fetch(
      `https://www.linkedin.com/voyager/api/messaging/conversations/${conversationId}/events?count=10`,
      {
        headers: {
          'accept': 'application/vnd.linkedin.normalized+json+2.1',
          'csrf-token': csrfToken,
          'x-restli-protocol-version': '2.0.0'
        },
        credentials: 'include'
      }
    );

    console.log('   Status:', response.status);

    if (response.ok) {
      const data = await response.json();
      const included = data.included || [];

      // Get message events
      const events = included.filter(e => e['$type'] === 'com.linkedin.voyager.messaging.Event');
      console.log('   ✅ Found', events.length, 'message events');

      // Show recent messages
      console.log('\n3. Recent messages:');
      events.slice(0, 5).forEach((event, i) => {
        const content = event.eventContent?.attributedBody?.text ||
                       event.eventContent?.body ||
                       '[no text]';
        const timestamp = new Date(event.createdAt).toLocaleString();
        console.log(`   ${i + 1}. [${timestamp}] ${content.substring(0, 50)}...`);
      });

      return { conversationId, events, data };
    } else {
      const text = await response.text();
      console.log('   ❌ Failed:', text.substring(0, 200));
      return false;
    }
  } catch (e) {
    console.log('   ❌ Error:', e.message);
    return false;
  }
};

// ==================== PHASE 4: Full Sync Test ====================
window.debugPhase4 = async function() {
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 4: Testing full sync flow via extension...');
  console.log('='.repeat(60));

  try {
    // Send sync request to background
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'SYNC_CONVERSATIONS_VIA_API',
        count: 10
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });

    console.log('Sync response:', response);

    if (response?.success) {
      console.log('✅ Sync successful');
      console.log('   Conversations found:', response.conversations?.length || 0);

      if (response.conversations?.length > 0) {
        console.log('\n   Conversations:');
        response.conversations.slice(0, 5).forEach((conv, i) => {
          console.log(`   ${i + 1}. ${conv.participant_name || 'Unknown'} - ${conv.linkedin_conversation_id?.substring(0, 30)}...`);
        });
      }
    } else {
      console.log('❌ Sync failed:', response?.error);
    }

    return response;
  } catch (e) {
    console.log('❌ Error:', e.message);
    return false;
  }
};

// ==================== Quick Status ====================
window.debugStatus = async function() {
  console.log('\n' + '='.repeat(60));
  console.log('INBOX DEBUG STATUS');
  console.log('='.repeat(60));
  console.log('Current URL:', window.location.href);
  console.log('On messaging page:', window.location.href.includes('/messaging/') ? '✅' : '❌');

  const urlMatch = window.location.href.match(/\/messaging\/thread\/([^/?]+)/);
  console.log('On conversation thread:', urlMatch ? '✅ ' + urlMatch[1].substring(0, 30) + '...' : '❌');

  // Check CSRF
  const csrfToken = document.cookie.split(';').find(c => c.trim().startsWith('JSESSIONID='));
  console.log('CSRF token:', csrfToken ? '✅ Found' : '❌ Not found');

  // Check extension
  const hasExtension = typeof chrome !== 'undefined' && chrome.runtime;
  console.log('Extension loaded:', hasExtension ? '✅' : '❌');

  console.log('\nRun these commands to debug:');
  console.log('  debugPhase1() - Check extension');
  console.log('  debugPhase2() - Check API access');
  console.log('  debugPhase3() - Fetch current conversation messages');
  console.log('  debugPhase4() - Test full sync');
  console.log('='.repeat(60));
};

// Auto-run status
debugStatus();
