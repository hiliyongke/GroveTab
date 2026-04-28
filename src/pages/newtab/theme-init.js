/**
 * theme-init.js — 在 React 启动前设置 data-theme，避免暗色模式首屏白闪。
 * Chrome MV3 禁止内联脚本，因此必须作为扩展内置外部脚本加载。
 */
(function () {
  var PREPAINT_KEY = 'app_prepaint_theme';
  var LEGACY_PREPAINT_KEY = 'grovetab_prepaint_theme';

  function getSystemTheme() {
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch (e) {
      return 'light';
    }
  }

  function normalizeTheme(value) {
    if (value === 'dark' || value === 'light') return value;
    return null;
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.backgroundColor = theme === 'dark' ? '#141414' : '#f5f5f5';
    document.documentElement.style.colorScheme = theme;
    if (document.body) {
      document.body.style.backgroundColor = theme === 'dark' ? '#141414' : '#f5f5f5';
    }
  }

  var cachedTheme = null;
  try {
    cachedTheme = normalizeTheme(window.localStorage.getItem(PREPAINT_KEY)) || normalizeTheme(window.localStorage.getItem(LEGACY_PREPAINT_KEY));
  } catch (e) {
    cachedTheme = null;
  }

  applyTheme(cachedTheme || getSystemTheme());

  try {
  // 注：此键名需与 STORAGE_KEYS.settings 保持一致（由品牌 storagePrefix + 'settings' 拼接）。
  chrome.storage.local.get('canopy_settings', function (result) {
    var settings = result && result.canopy_settings;
      var userTheme = settings && settings.theme;
      var resolvedTheme = userTheme === 'system' || userTheme === undefined
        ? getSystemTheme()
        : normalizeTheme(userTheme);
      if (resolvedTheme !== null) {
        applyTheme(resolvedTheme);
        try {
          window.localStorage.setItem(PREPAINT_KEY, resolvedTheme);
        } catch (e) {
          // ignore
        }
      }
    });
  } catch (e) {
    // chrome.storage 不可用时，保留同步预判主题。
  }
})();
