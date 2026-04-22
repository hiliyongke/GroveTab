// Service Worker entry point for Canopy
// Minimal implementation — will be expanded in Phase 2

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Canopy] Extension installed:', details.reason);
});

// Message router — will be expanded in Phase 2
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log('[Canopy] Message received:', message);
  sendResponse({ ok: true });
});
