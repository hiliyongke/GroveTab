/**
 * theme-init.js — Runs before React to prevent FOUC
 * Chrome Extension MV3 CSP allows extension-bundled scripts, but NOT inline scripts.
 * This external script sets data-theme before React renders.
 */
(function () {
  // Step 1: Detect system preference immediately (synchronous)
  var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  // Step 2: Apply system theme as default (no flash)
  var defaultTheme = systemDark ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', defaultTheme);
  // Step 3: Async load user preference and correct if needed
  try {
    chrome.storage.local.get('canopy_settings', function (result) {
      if (result.canopy_settings && result.canopy_settings.theme) {
        var userTheme = result.canopy_settings.theme;
        if (userTheme === 'system') {
          // Already applied system preference, no change needed
        } else {
          document.documentElement.setAttribute('data-theme', userTheme);
        }
      }
    });
  } catch (e) {
    // chrome.storage not available (e.g. in dev mode), system theme is fine
  }
})();
