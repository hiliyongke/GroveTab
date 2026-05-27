/**
 * FocusTime Repository —— 标签页使用时长数据存取
 *
 * 数据在 Service Worker 中采集，通过 chrome.storage.local 持久化。
 * 按 URL × day 聚合，保留最近 30 天。
 */

import { storageGet, storageSet } from "@/chrome";
import { STORAGE_KEYS } from "@/shared/config/storage-keys";
import type { FocusTimeData, ActiveFocusSession } from "@/shared/types";

const SESSION_KEY = "active_focus_session";

export async function getFocusTime(): Promise<FocusTimeData | null> {
  const data = await storageGet<FocusTimeData>(STORAGE_KEYS.focusTime);
  return data ?? null;
}

export async function saveFocusTime(data: FocusTimeData): Promise<void> {
  await storageSet(STORAGE_KEYS.focusTime, data);
}

/** 从 chrome.storage.session 读取当前激活会话（MV3，SW 挂起后保留） */
export async function getActiveFocusSession(): Promise<ActiveFocusSession | null> {
  try {
    const result = await chrome.storage.session.get(SESSION_KEY);
    return (result[SESSION_KEY] as ActiveFocusSession | undefined) ?? null;
  } catch {
    // storage.session 可能在某些环境下不可用
    return null;
  }
}

/** 写入当前激活会话到 chrome.storage.session */
export async function setActiveFocusSession(session: ActiveFocusSession | null): Promise<void> {
  try {
    if (session === null) {
      await chrome.storage.session.remove(SESSION_KEY);
    } else {
      await chrome.storage.session.set({ [SESSION_KEY]: session });
    }
  } catch {
    // ignore
  }
}
