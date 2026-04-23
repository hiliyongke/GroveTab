/**
 * StorageRepo — Partitioned chrome.storage.local wrapper
 *
 * Data is stored under namespaced keys (canopy_tabs, canopy_settings, etc.)
 * to avoid reading all data on every access.
 */

import { storageGet, storageSet } from '@/chrome';
import type { StorageKey, StorageMeta, UserSettings } from '@/shared/types';

const CURRENT_SCHEMA_VERSION = 1;

const DEFAULT_SETTINGS: UserSettings = {
  overrideNewTab: true,
  defaultView: 'domain',
  theme: 'system',
  gradientPreset: 'slate',
  skinPreset: 'minimal',
  showIncognito: false,
  language: 'zh-CN',
  domainGroupColumns: 'auto',
  domainGroupShowItemFavicon: true,
  domainGroupAccentBarPosition: 'left',
  domainGroupCardRadius: 'default',
  searchScope: ['title', 'hostname', 'url'],
  searchEnablePinyin: true,
  searchSortBy: 'relevance',
  searchDefaultEngine: 'google',
  searchEnabledEngines: ['google', 'bing', 'baidu', 'duckduckgo'],
  searchAutoFallbackToWeb: true,
  searchUseHistorySuggestions: true,
  searchUseHotSuggestions: true,
  layoutDensity: 'default',
  contentMaxWidth: 1360,
  reducedMotion: 'auto',
  uiVisibility: {
    header: true,
    heroSearch: true,
    viewSwitcher: true,
    workspaceOverview: true,
    tidySuggestion: true,
  },
};

// ── Generic CRUD ──────────────────────────────────────

export async function getData<T>(key: StorageKey): Promise<T | undefined> {
  return storageGet<T>(key);
}

export async function setData<T>(key: StorageKey, value: T): Promise<void> {
  await storageSet(key, value);
  await updateMetaTimestamp();
}

// ── Settings ──────────────────────────────────────────

export async function getSettings(): Promise<UserSettings> {
  const settings = await getData<UserSettings>('canopy_settings');
  if (!settings) return { ...DEFAULT_SETTINGS };
  /**
   * 旧值迁移：aurora → slate，sunrise → warm
   * 2026-04-23 预设体系重命名后，存量用户磁盘里可能还存着旧 ID。
   */
  if (settings.gradientPreset === 'aurora' as string) settings.gradientPreset = 'slate';
  if (settings.gradientPreset === 'sunrise' as string) settings.gradientPreset = 'warm';
  return settings;
}

export async function saveSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
  const current = await getSettings();
  const merged = { ...current, ...settings };
  await setData('canopy_settings', merged);
  return merged;
}

// ── Meta ──────────────────────────────────────────────

async function getMeta(): Promise<StorageMeta | undefined> {
  return getData<StorageMeta>('canopy_meta');
}

async function ensureMeta(): Promise<StorageMeta> {
  let meta = await getMeta();
  if (!meta) {
    meta = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await setData('canopy_meta', meta);
  }
  return meta;
}

async function updateMetaTimestamp(): Promise<void> {
  const meta = await getMeta();
  if (meta) {
    meta.updatedAt = Date.now();
    await setData('canopy_meta', meta);
  }
}

// ── Onboarding ────────────────────────────────────────

const ONBOARDING_KEY = 'canopy_onboarding_done' as StorageKey;

export async function hasCompletedOnboarding(): Promise<boolean> {
  const done = await getData<boolean>(ONBOARDING_KEY);
  return done ?? false;
}

export async function markOnboardingDone(): Promise<void> {
  await setData(ONBOARDING_KEY, true);
}

// ── Search History ─────────────────────────────────────

const SEARCH_HISTORY_KEY = 'canopy_search_history' as StorageKey;
const MAX_RECENT_SEARCHES = 12;

/**
 * 获取最近搜索词。
 */
export async function getRecentSearches(): Promise<string[]> {
  return (await getData<string[]>(SEARCH_HISTORY_KEY)) ?? [];
}

/**
 * 记录一条最近搜索词。
 */
export async function pushRecentSearch(query: string): Promise<string[]> {
  const normalized = query.trim();
  if (normalized === '') return getRecentSearches();

  const existing = await getRecentSearches();
  const deduped = [normalized, ...existing.filter((item) => item !== normalized)].slice(0, MAX_RECENT_SEARCHES);
  await setData(SEARCH_HISTORY_KEY, deduped);
  return deduped;
}

// Initialize meta on module load
void ensureMeta();
