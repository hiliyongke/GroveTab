/**
 * 金句服务
 *
 * 职责：
 *   1. 按日期稳定选取今日金句（保证全天同一设备看到同一句）。
 *   2. 支持"下一条"手动轮换（在当天的过滤集合内顺序递增）。
 *   3. 收藏夹：读 / 写 / 清空 / 是否已收藏。
 *
 * 存储：
 *   - 应用命名空间金句收藏键：string[]（收藏 quote.id 列表，LRU，最多 200 条）
 *
 * 数据流：
 *   UI ──read──► getTodayQuote(settings.quoteCategories) ──filter──► QUOTES
 *   UI ──click "next"──► getQuoteByOffset(+1)（当天内 step）
 *   UI ──click ♥──► toggleFavorite(id)
 */

import { getData, setData } from '@/repositories/storage-repo';
import { useSettingsStore } from '@/store';
import {
  QUOTES,
  filterByCategories,
  type Quote,
  type QuoteCategory,
} from './quotes-data';
import { CONFIG } from '@/shared/config';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';

const FAV_KEY = STORAGE_KEYS.quoteFavs;
const MAX_FAVS = CONFIG.business.maxQuoteFavorites;

// ── 稳定哈希 ────────────────────────────────────────
/**
 * 一个低冲突的 32-bit 字符串哈希（DJB2 变体），仅用于"把日期字符串映射为稳定数组下标"，不要求加密强度。
 */
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** 获取本地 `YYYY-MM-DD` 字符串（稳定选取的 seed）。 */
function localDateKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ── 公开 API ────────────────────────────────────────

function getAllQuotes(): Quote[] {
  try {
    const current = useSettingsStore.getState().settings;
    const customQuotes = current.dailyQuote?.customQuotes ?? [];
    return [...QUOTES, ...customQuotes];
  } catch {
    return QUOTES;
  }
}

/**
 * 今日金句：稳定选取（按本地日期）。
 * 如果过滤后为空集（用户把所有分类都关了），回退到全量金句。
 */
export function getTodayQuote(
  categories: QuoteCategory[],
  offset = 0,
  now = new Date(),
): Quote {
  const allQuotes = getAllQuotes();
  const pool = filterByCategories(allQuotes, categories);
  const list = pool.length > 0 ? pool : allQuotes;
  const baseIdx = hashString(localDateKey(now)) % list.length;
  const finalIdx = (baseIdx + offset + list.length * 1000) % list.length;
  return list[finalIdx];
}

/** 完全随机选取一条（用于"来点别的"按钮，避免顺序可预测）。 */
export function getRandomQuote(categories: QuoteCategory[]): Quote {
  const allQuotes = getAllQuotes();
  const pool = filterByCategories(allQuotes, categories);
  const list = pool.length > 0 ? pool : allQuotes;
  return list[Math.floor(Math.random() * list.length)];
}

/** 通过 id 查找（容错 undefined） */
export function findQuoteById(id: string): Quote | undefined {
  return getAllQuotes().find((q) => q.id === id);
}

// ── 收藏夹 ──────────────────────────────────────────

async function readFavIds(): Promise<string[]> {
  // storage-repo 的 StorageKey 是受限联合类型，这里绕过类型门（FAV_KEY 非官方键位）。
  // 使用底层 chrome.storage 直接读写，不破坏 storage-repo 的类型契约。
  const all = await chrome.storage.local.get(FAV_KEY);
  const raw = all[FAV_KEY];
  return Array.isArray(raw) ? (raw as string[]) : [];
}

async function writeFavIds(ids: string[]): Promise<void> {
  await chrome.storage.local.set({ [FAV_KEY]: ids.slice(0, MAX_FAVS) });
}

/** 读收藏的完整 Quote 列表（过滤掉已不存在的 id）。 */
export async function getFavoriteQuotes(): Promise<Quote[]> {
  const ids = await readFavIds();
  const out: Quote[] = [];
  for (const id of ids) {
    const q = findQuoteById(id);
    if (q !== undefined) out.push(q);
  }
  return out;
}

export async function isFavorite(id: string): Promise<boolean> {
  const ids = await readFavIds();
  return ids.includes(id);
}

/** 收藏 / 取消收藏，返回是否收藏。 */
export async function toggleFavorite(id: string): Promise<boolean> {
  const ids = await readFavIds();
  const idx = ids.indexOf(id);
  if (idx >= 0) {
    ids.splice(idx, 1);
    await writeFavIds(ids);
    return false;
  }
  // 新增 → 放到头部（便于"最近收藏"展示）
  ids.unshift(id);
  await writeFavIds(ids);
  return true;
}

/** 清空收藏夹。 */
export async function clearFavorites(): Promise<void> {
  await writeFavIds([]);
}

// 避免 "getData/setData unused" 警告（保留以便未来若把 FAV_KEY 纳入 StorageKey 联合类型时用）
void getData;
void setData;
