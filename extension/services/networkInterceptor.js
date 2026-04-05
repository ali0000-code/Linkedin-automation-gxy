/**
 * Network Interceptor — runs in the PAGE context (not content script isolated world).
 *
 * Overrides window.fetch and XMLHttpRequest to passively capture LinkedIn's own
 * messaging API responses as they happen. Data is sent to the content script
 * via window.postMessage.
 *
 * This replaces the click-based extraction approach — no UI disruption, works
 * in the background as LinkedIn naturally loads data.
 */
(function () {
  'use strict';

  // Patterns for messaging-related API calls
  const MESSAGING_PATTERNS = [
    /voyagerMessagingGraphQL/,
    /voyagerMessagingDashMessengerConversations/,
    /voyagerMessagingDashMessengerMessages/,
    /messaging\/conversations/,
    /messengerConversations/,
    /messengerMessages/,
  ];

  const isMessagingUrl = (url) => {
    if (!url) return false;
    return MESSAGING_PATTERNS.some(p => p.test(url));
  };

  // DEBUG: log every LinkedIn voyager/realtime URL to find the conversation list source
  window.__liAllUrls = [];
  const isLinkedInApi = (url) => url && (url.includes('/voyager/') || url.includes('/realtime/') || url.includes('/messaging/'));

  // Store debug info accessible from page console
  window.__liIntercepted = { count: 0, urls: [], conversations: 0, messages: 0, lastResponse: null, responses: [], capturedData: [] };

  // Listen for replay requests from content script (which loads at document_idle,
  // AFTER we've already captured LinkedIn's initial fetches)
  window.addEventListener('message', (event) => {
    if (event.data?.type === '__LI_REPLAY_REQUEST__') {
      console.log(`[NetInterceptor] Replaying ${window.__liIntercepted.capturedData.length} cached responses`);
      for (const cached of window.__liIntercepted.capturedData) {
        window.postMessage({
          type: '__LI_NET_INTERCEPT__',
          url: cached.url,
          data: cached.data,
          timestamp: cached.timestamp,
          replay: true,
        }, '*');
      }
    }
    // Bridge content script logs to main-world console (so they appear in page console)
    if (event.data?.type === '__LI_BRIDGE_LOG__') {
      console.log('[CS]', ...(event.data.args || []));
    }
  });

  // --- Realtime (SSE/streaming) event buffer ---
  window.__liRealtimeEvents = [];

  // Parse a streaming chunk and extract JSON events (LinkedIn uses newline-delimited JSON or SSE)
  const processStreamChunk = (text, urlForLog) => {
    // LinkedIn's realtime uses newline-delimited JSON
    const lines = text.split('\n').filter(l => l.trim());
    for (const line of lines) {
      // SSE format: "data: {...}"
      const payload = line.startsWith('data:') ? line.substring(5).trim() : line.trim();
      if (!payload || payload[0] !== '{') continue;
      try {
        const data = JSON.parse(payload);
        // Only capture messaging-related events
        const str = JSON.stringify(data);
        if (str.includes('msg_conversation') || str.includes('messagingMessage') || str.includes('messenger')) {
          window.__liRealtimeEvents.unshift({ data, time: Date.now() });
          window.__liRealtimeEvents = window.__liRealtimeEvents.slice(0, 50);
          console.log('[NetInterceptor] 📡 Realtime event captured:', Object.keys(data).slice(0, 5).join(','));
          window.postMessage({
            type: '__LI_REALTIME__',
            data,
            timestamp: Date.now(),
          }, '*');
        }
      } catch {}
    }
  };

  // --- Intercept fetch ---
  const originalFetch = window.fetch;

  window.fetch = async function (...args) {
    const request = args[0];
    const url = typeof request === 'string' ? request : request?.url;

    const response = await originalFetch.apply(this, args);

    // DEBUG: log all LinkedIn API URLs to find the conversation list source
    if (isLinkedInApi(url)) {
      window.__liAllUrls.unshift({ url: url.substring(0, 200), time: Date.now() });
      window.__liAllUrls = window.__liAllUrls.slice(0, 50);
    }

    // Intercept realtime streaming connection
    if (url && url.includes('/realtime/')) {
      console.log('[NetInterceptor] 📡 Realtime connection opened:', url.substring(0, 100));
      try {
        const clone = response.clone();
        const reader = clone.body?.getReader();
        const decoder = new TextDecoder();
        if (reader) {
          let buffer = '';
          (async () => {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split('\n');
                buffer = parts.pop() || '';
                for (const part of parts) {
                  if (part.trim()) processStreamChunk(part, url);
                }
              }
            } catch (e) {
              console.log('[NetInterceptor] Realtime stream ended:', e.message);
            }
          })();
        }
      } catch (e) {
        console.warn('[NetInterceptor] Failed to hook realtime stream:', e.message);
      }
    }

    if (isMessagingUrl(url)) {
      window.__liIntercepted.count++;
      window.__liIntercepted.urls.unshift(url.substring(0, 150));
      window.__liIntercepted.urls = window.__liIntercepted.urls.slice(0, 10);
      console.log('[NetInterceptor] Captured:', url.substring(0, 120));

      const clone = response.clone();
      clone.text().then(text => {
        try {
          const data = JSON.parse(text);
          const includedCount = data.included?.length || 0;
          const elementsCount = (data.data?.elements || data.elements || []).length;

          // Store last 30 full responses for inspection
          window.__liIntercepted.responses.unshift({ url: url.substring(0, 200), topKeys: Object.keys(data), dataKeys: data.data ? Object.keys(data.data) : null, data });
          window.__liIntercepted.responses = window.__liIntercepted.responses.slice(0, 30);

          // Store captured data for replay to content script (which loads later)
          window.__liIntercepted.capturedData.push({ url, data, timestamp: Date.now() });
          // Keep only last 50 captures
          if (window.__liIntercepted.capturedData.length > 50) {
            window.__liIntercepted.capturedData.shift();
          }
          window.__liIntercepted.lastResponse = data;

          console.log(`[NetInterceptor] Parsed: included=${includedCount}, elements=${elementsCount}, topKeys=[${Object.keys(data).join(',')}]${data.data ? ', dataKeys=[' + Object.keys(data.data).join(',') + ']' : ''}`);

          window.postMessage({
            type: '__LI_NET_INTERCEPT__',
            url,
            data,
            timestamp: Date.now(),
          }, '*');
        } catch (e) {
          // Not JSON — ignore
        }
      }).catch(() => {});
    }

    return response;
  };

  // --- Intercept XMLHttpRequest ---
  const XHRProto = XMLHttpRequest.prototype;
  const originalOpen = XHRProto.open;
  const originalSend = XHRProto.send;

  XHRProto.open = function (method, url, ...rest) {
    this.__liUrl = url;
    return originalOpen.apply(this, [method, url, ...rest]);
  };

  XHRProto.send = function (...args) {
    if (isMessagingUrl(this.__liUrl)) {
      this.addEventListener('load', function () {
        try {
          const data = JSON.parse(this.responseText);
          window.postMessage({
            type: '__LI_NET_INTERCEPT__',
            url: this.__liUrl,
            data,
            timestamp: Date.now(),
          }, '*');
        } catch (e) {}
      });
    }
    return originalSend.apply(this, args);
  };

  console.log('[NetworkInterceptor] Messaging API interception active');
})();
