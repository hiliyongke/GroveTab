/**
 * chrome.storage.local 封装层，所有操作经 safeCall 包装。
 */

import { safeCall } from "./safe-call";

/** 获取 chrome.storage.local 已用字节数；出错时返回 0。 */
export async function getStorageBytesInUse(
  keys: string | string[] | null = null,
): Promise<number> {
  try {
    return await safeCall("storage.local.getBytesInUse", () =>
      chrome.storage.local.getBytesInUse(keys),
    );
  } catch {
    return 0;
  }
}

/** 读取 chrome.storage.local 数据；null 表示读取全部。 */
export async function getStorageLocal(
  keys: string | string[] | null,
): Promise<Record<string, unknown>> {
  try {
    return (await safeCall("storage.local.get", () =>
      chrome.storage.local.get(keys),
    )) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** 写入 chrome.storage.local。 */
export async function setStorageLocal(items: Record<string, unknown>): Promise<void> {
  await safeCall("storage.local.set", () => chrome.storage.local.set(items));
}

/** 删除 chrome.storage.local 指定键。 */
export async function removeStorageLocal(keys: string | string[]): Promise<void> {
  await safeCall("storage.local.remove", () => chrome.storage.local.remove(keys));
}

// ── chrome.storage.sync（跨设备同步，需登录同一 Chrome 账号） ──
// 注：sync 与 local 共用 "storage" 权限，无需额外声明。
// 配额限制：单 item ≤ 8KB，总计 ≤ 100KB，≤ 512 items。仅用于轻量配置。

/** chrome.storage.sync 是否可用（部分环境/隐身分屏下可能缺失）。 */
export function isStorageSyncAvailable(): boolean {
  return typeof chrome !== "undefined" && chrome.storage?.sync !== undefined;
}

/** 读取 chrome.storage.sync 数据；不可用或出错时返回 {}。 */
export async function getStorageSync(
  keys: string | string[] | null,
): Promise<Record<string, unknown>> {
  if (!isStorageSyncAvailable()) return {};
  try {
    return (await safeCall("storage.sync.get", () =>
      chrome.storage.sync.get(keys),
    )) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** 写入 chrome.storage.sync（不可用时静默跳过；配额超限由调用方决定如何提示）。 */
export async function setStorageSync(items: Record<string, unknown>): Promise<void> {
  if (!isStorageSyncAvailable()) return;
  await safeCall("storage.sync.set", () => chrome.storage.sync.set(items));
}
