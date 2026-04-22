/**
 * StorageRepo — Partitioned chrome.storage.local wrapper
 *
 * Data is stored under namespaced keys (canopy_tabs, canopy_settings, etc.)
 * to avoid reading all data on every access.
 */

import { storageGet, storageSet, storageRemove, storageGetBytesInUse } from '@/chrome';
import type { StorageKey, StorageMeta, UserSettings } from '@/shared/types';

const CURRENT_SCHEMA_VERSION = 1;

const DEFAULT_SETTINGS: UserSettings = {
  overrideNewTab: true,
  defaultView: 'domain',
  theme: 'system',
  gradientPreset: 'aurora',
  showIncognito: false,
  language: 'zh-CN',
};

// ── Generic CRUD ──────────────────────────────────────

export async function getData<T>(key: StorageKey): Promise<T | undefined> {
  return storageGet<T>(key);
}

export async function setData<T>(key: StorageKey, value: T): Promise<void> {
  await storageSet(key, value);
  await updateMetaTimestamp();
}

export async function removeData(key: StorageKey): Promise<void> {
  await storageRemove(key);
  await updateMetaTimestamp();
}

// ── Settings ──────────────────────────────────────────

export async function getSettings(): Promise<UserSettings> {
  const settings = await getData<UserSettings>('canopy_settings');
  return settings ?? { ...DEFAULT_SETTINGS };
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

// ── Capacity ──────────────────────────────────────────

const WARN_THRESHOLD = 8 * 1024 * 1024; // 8 MiB
const MAX_QUOTA = 10 * 1024 * 1024; // 10 MiB (chrome.storage.local limit)

export async function getStorageUsage(): Promise<{ used: number; quota: number; percent: number; warn: boolean }> {
  const used = await storageGetBytesInUse();
  return {
    used,
    quota: MAX_QUOTA,
    percent: Math.round((used / MAX_QUOTA) * 100),
    warn: used > WARN_THRESHOLD,
  };
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

// Initialize meta on module load
ensureMeta();
