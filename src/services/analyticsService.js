// Simple analytics service to track page views
// Sends pageview data to backend on each route change

const ANALYTICS_ENDPOINT = '/api/analytics/pageview';

// Generate or retrieve a persistent session ID
function getSessionId() {
  let sessionId = sessionStorage.getItem('mohe_session_id');
  if (!sessionId) {
    sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    sessionStorage.setItem('mohe_session_id', sessionId);
  }
  return sessionId;
}

// Debounce to prevent duplicate tracking on rapid navigation
let lastTrackedPath = null;
let lastTrackedTime = 0;
const DEBOUNCE_MS = 1000; // 1 second debounce

export function trackPageview(pagePath) {
  const now = Date.now();
  if (pagePath === lastTrackedPath && now - lastTrackedTime < DEBOUNCE_MS) {
    return; // Skip duplicate
  }
  lastTrackedPath = pagePath;
  lastTrackedTime = now;

  const data = {
    sessionId: getSessionId(),
    pagePath: pagePath,
    referrer: document.referrer || null,
  };

  // Fire and forget - don't block navigation
  fetch(ANALYTICS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).catch(() => {}); // Silently fail - analytics should never break UX
}
