/**
 * chrome.storage.local 封装层
 *
 * 所有对 chrome.storage.local 的访问必须通过此文件，
 * 禁止在 repositories 层以外的业务代码中直接调用 chrome.storage.*。
 */

/**
 * 获取 chrome.storage.local 当前已使用的字节数
 * @returns 已使用字节数；出错时返回 0
 */
export async function getStorageBytesInUse(keys: string | string[] | null = null): Promise<number> {
  try {
    return await chrome.storage.local.getBytesInUse(keys);
  } catch {
    return 0;
  }
}

/**
 * 从 chrome.storage.local 读取数据
 * @param keys 要读取的键名或键名数组，null 表示读取全部
 */
export async function getStorageLocal(
  keys: string | string[] | null,
): Promise<Record<string, unknown>> {
  try {
    return (await chrome.storage.local.get(keys)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * 向 chrome.storage.local 写入数据
 * @param items 要写入的键值对
 */
export async function setStorageLocal(items: Record<string, unknown>): Promise<void> {
  await chrome.storage.local.set(items);
}

/**
 * 从 chrome.storage.local 删除指定键
 * @param keys 要删除的键名或键名数组
 */
export async function removeStorageLocal(keys: string | string[]): Promise<void> {
  await chrome.storage.local.remove(keys);
}
