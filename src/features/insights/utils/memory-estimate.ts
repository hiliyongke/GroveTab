/**
 * insights/utils/memory-estimate.ts — 内存占用估算
 *
 * 基于 URL 特征加权：
 *   - /watch/, /v/, /video/, /player/ → 视频/媒体标签，+300 MB
 *   - /image/, /photo/, /img/, /pic/    → 图片富媒体标签，+150 MB
 *   - /doc/, /document/, /sheets/, /slides/ → JS 密集型应用，+200 MB
 *   - 其他 → 常规标签，80 MB
 *
 * 数值仅用于"提示性展示"，并非真实测量。
 */

export function estimateMemMBByUrl(url: string): number {
  const u = url.toLowerCase();
  if (/\/(watch\?|v\/|video\/|player\/|shorts\b)/.test(u)) return 300;
  if (/\/(image\/|photo\/|img\/|pic\/|image\?|\.jpg|\.png|\.webp|\.gif|\/gallery)/.test(u)) return 150;
  if (/\/(doc\/|document\/|sheets\/|slides\/|office\/|docs\.google)/.test(u)) return 200;
  return 80;
}

export interface ArchiveStats {
  totalTabs: number;
  savedMemMB: number;
}

export function computeArchiveStats(events: Array<{ event: string; payload?: unknown }>): ArchiveStats {
  let totalTabs = 0;
  let savedMemMB = 0;
  for (const ev of events) {
    if (ev.event !== "archive" && ev.event !== "archive_create") continue;
    const payload = (ev.payload ?? {}) as { count?: number; tabs?: unknown };
    const count = typeof payload.count === "number" ? payload.count : 0;
    const tabUrls = Array.isArray(payload.tabs) ? (payload.tabs as unknown[]).filter((u): u is string => typeof u === "string") : [];
    totalTabs += count;
    for (const url of tabUrls) savedMemMB += estimateMemMBByUrl(url);
  }
  return { totalTabs, savedMemMB };
}
