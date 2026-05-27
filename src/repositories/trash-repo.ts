/**
 * TrashRepo — 回收站数据层
 *
 * 提供回收站的增删改查和自动清理功能。
 */

import { getData, setData } from "@/repositories/storage-repo";
import { STORAGE_KEYS } from "@/shared/config/storage-keys";
import type { TrashedItem, TrashedTab } from "@/shared/types/trash";

const MAX_TRASH_ITEMS = 200;
const TRASH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天自动过期

/** 获取回收站所有条目 */
export async function getTrashItems(): Promise<TrashedItem[]> {
  const items = (await getData<TrashedItem[]>(STORAGE_KEYS.trash)) ?? [];
  const now = Date.now();
  // 过滤过期项
  const valid = items.filter((item) => now - item.trashedAt < TRASH_TTL_MS);
  if (valid.length < items.length) {
    await setData(STORAGE_KEYS.trash, valid);
  }
  return valid.sort((a, b) => b.trashedAt - a.trashedAt);
}

/** 将标签页放入回收站 */
export async function addToTrash(tabs: TrashedTab[]): Promise<TrashedItem[]> {
  if (tabs.length === 0) return getTrashItems();
  const existing = await getTrashItems();
  const hostname = tabs[0]?.hostname ?? "未知";
  const name =
    tabs.length === 1
      ? `${hostname} · ${tabs[0]?.title ?? ""}`.slice(0, 80)
      : `${hostname} · ${tabs.length} 个标签`;
  const item: TrashedItem = {
    id: `trash-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tabs,
    name,
    trashedAt: Date.now(),
  };
  const next = [item, ...existing].slice(0, MAX_TRASH_ITEMS);
  await setData(STORAGE_KEYS.trash, next);
  return next;
}

/** 从回收站恢复条目 */
export async function removeFromTrash(itemId: string): Promise<TrashedItem[]> {
  const items = await getTrashItems();
  const next = items.filter((item) => item.id !== itemId);
  await setData(STORAGE_KEYS.trash, next);
  return next;
}

/** 清空回收站 */
export async function clearTrash(): Promise<void> {
  await setData(STORAGE_KEYS.trash, []);
}

/** 手动清理过期条目 */
export async function pruneTrash(): Promise<number> {
  const items = (await getData<TrashedItem[]>(STORAGE_KEYS.trash)) ?? [];
  const now = Date.now();
  const valid = items.filter((item) => now - item.trashedAt < TRASH_TTL_MS);
  if (valid.length < items.length) {
    await setData(STORAGE_KEYS.trash, valid);
  }
  return items.length - valid.length;
}
