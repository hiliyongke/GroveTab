/**
 * theme-init.js — 在 React 启动前设置 data-theme + data-skin，避免首屏白闪与皮肤跳变。
 * Chrome MV3 禁止内联脚本，因此必须作为扩展内置外部脚本加载。
 */
(function () {
  var PREPAINT_KEY = 'app_prepaint_theme';
  var SKIN_PREPAINT_KEY = 'app_prepaint_skin';

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

  /**
   * 应用主题到 DOM
   */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.backgroundColor = theme === 'dark' ? '#141414' : '#f5f5f5';
    document.documentElement.style.colorScheme = theme;
    if (document.body) {
      document.body.style.backgroundColor = theme === 'dark' ? '#141414' : '#f5f5f5';
    }
  }

  /** 应用皮肤到 DOM，使 _skin-overrides.less 立即生效 */
  function applySkin(skinId) {
    if (skinId) {
      document.documentElement.setAttribute('data-skin', skinId);
    }
  }

  var cachedTheme = null;
  try {
    cachedTheme = normalizeTheme(window.localStorage.getItem(PREPAINT_KEY));
  } catch (e) {
    cachedTheme = null;
  }

  var cachedSkin = null;
  try {
    cachedSkin = window.localStorage.getItem(SKIN_PREPAINT_KEY);
  } catch (e) {
    cachedSkin = null;
  }

  applyTheme(cachedTheme || getSystemTheme());
  applySkin(cachedSkin);

  try {
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
        } catch (e) { /* ignore */ }
      }

      var userSkin = settings && settings.skinPreset;
      if (userSkin) {
        applySkin(userSkin);
        try {
          window.localStorage.setItem(SKIN_PREPAINT_KEY, userSkin);
        } catch (e) { /* ignore */ }
      }
    });
  } catch (e) {
    // chrome.storage 不可用时，保留同步预判主题与皮肤。
  }
})();
