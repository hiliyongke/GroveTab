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
