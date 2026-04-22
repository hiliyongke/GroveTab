/**
 * Chrome API — Promisified wrappers for tabs, windows, sessions, storage
 */

// ── Tabs ──────────────────────────────────────────────

export async function queryAllTabs(): Promise<chrome.tabs.Tab[]> {
  return chrome.tabs.query({});
}

export async function queryCurrentWindowTabs(): Promise<chrome.tabs.Tab[]> {
  return chrome.tabs.query({ currentWindow: true });
}

export async function getTab(tabId: number): Promise<chrome.tabs.Tab | undefined> {
  try {
    return await chrome.tabs.get(tabId);
  } catch {
    return undefined;
  }
}

export async function activateTab(tabId: number, windowId?: number): Promise<void> {
  await chrome.tabs.update(tabId, { active: true });
  if (windowId) {
    await chrome.windows.update(windowId, { focused: true });
  }
}

export async function closeTab(tabId: number): Promise<void> {
  await chrome.tabs.remove(tabId);
}

export async function closeTabs(tabIds: number[]): Promise<void> {
  await chrome.tabs.remove(tabIds);
}

// ── Windows ───────────────────────────────────────────

export async function getAllWindows(): Promise<chrome.windows.Window[]> {
  return chrome.windows.getAll({ populate: false });
}

export async function getWindow(windowId: number): Promise<chrome.windows.Window | undefined> {
  try {
    return await chrome.windows.get(windowId);
  } catch {
    return undefined;
  }
}

export async function createWindowWithTabs(urls: string[]): Promise<chrome.windows.Window> {
  const win = await chrome.windows.create({ url: urls });
  return win!;
}

// ── Sessions ──────────────────────────────────────────

export async function getRecentlyClosed(): Promise<chrome.sessions.Session[]> {
  return chrome.sessions.getRecentlyClosed();
}

export async function restoreSession(sessionId?: string): Promise<chrome.sessions.Session | undefined> {
  try {
    return await chrome.sessions.restore(sessionId);
  } catch {
    return undefined;
  }
}

// ── Storage ───────────────────────────────────────────

export async function storageGet<T>(key: string): Promise<T | undefined> {
  const result = await chrome.storage.local.get(key);
  return result[key] as T | undefined;
}

export async function storageSet<T>(key: string, value: T): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export async function storageRemove(key: string): Promise<void> {
  await chrome.storage.local.remove(key);
}

export async function storageGetBytesInUse(keys?: string | string[]): Promise<number> {
  return chrome.storage.local.getBytesInUse(keys);
}

// ── Favicon ───────────────────────────────────────────

export function getFaviconUrl(url: string, size: number = 32): string {
  try {
    const parsed = new URL(url);
    return `chrome://favicon2/${size}/${parsed.origin}`;
  } catch {
    return '';
  }
}
