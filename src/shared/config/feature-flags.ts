/**
 * Feature Flag Configuration
 *
 * v1.4 核心整合 — Feature Flag 体系，支持渐进式发布与回滚。
 * 所有 flag 默认开启（v1.4 即为当前稳定版）。
 */

export const FEATURE_FLAGS = {
  UNIFIED_TABS_VIEW: 'unified_tabs_view',
  ARCHIVE_TRASH_MERGED: 'archive_trash_merged',
  TABBAR_COMPACT: 'tabbar_compact',
  TIDY_SUGGESTION_INLINE: 'tidy_suggestion_inline',
  NEW_ONBOARDING_FLOW: 'new_onboarding_flow',
} as const;

export type FeatureFlagName = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

/** 所有 feature flag 的默认值（v1.4 全部默认开启）。 */
export const FEATURE_FLAG_DEFAULTS: Record<FeatureFlagName, boolean> = {
  unified_tabs_view: true,
  archive_trash_merged: true,
  tabbar_compact: true,
  tidy_suggestion_inline: true,
  new_onboarding_flow: true,
};

/**
 * 从 chrome.storage.local 读取 flag，fallback 到默认值。
 * 用于非 React 上下文（如 Service Worker 或工具函数）。
 */
export async function isFeatureEnabled(name: FeatureFlagName): Promise<boolean> {
  try {
    // 优先尝试从已加载的 store 同步读取
    const { useFeatureFlagStore } = await import(
      '@/shared/store/feature-flag-slice'
    );
    const store = useFeatureFlagStore.getState();
    if (store.loaded) {
      return store.isEnabled(name);
    }
  } catch {
    // store 未加载，回退到直接读 storage
  }
  try {
    const { storageGet } = await import('@/chrome');
    const { STORAGE_KEYS } = await import('@/shared/config/storage-keys');
    const flags = await storageGet<Partial<Record<FeatureFlagName, boolean>>>(
      STORAGE_KEYS.featureFlags,
    );
    if (flags && name in flags) {
      return flags[name] ?? FEATURE_FLAG_DEFAULTS[name];
    }
  } catch {
    // storage 读取失败，使用默认值
  }
  return FEATURE_FLAG_DEFAULTS[name];
}
