/**
 * OG Fetcher (F-24) — 新标签页打开后抓取页面 meta description。
 *
 * 从 sw/index.ts 抽离以改善可维护性（CODE-01）。
 */

import { CONFIG } from "@/shared/config";
import { getSettings } from "@/repositories";

const OG_CONCURRENCY = CONFIG.performance.ogConcurrency;
const OG_TIMEOUT_MS = CONFIG.performance.ogTimeoutMs;
const OG_MAX_BYTES = CONFIG.performance.ogMaxBytes;

/** SSRF 防御：检查 hostname 是否为内网/私有/本地地址 */
const INTERNAL_HOST_PATTERNS = [
  /^127\.\d+\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2[0-9]|3[01])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^169\.254\.\d+\.\d+$/,
  /^0\.0\.0\.0$/,
  /^localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /\.corp$/i,
];

function isInternalHostname(hostname: string): boolean {
  if (hostname === "[::1]" || hostname === "::1" || hostname === "ip6-localhost") return true;
  if (hostname.startsWith("[fe80:") || hostname.startsWith("fe80:")) return true;
  for (const pattern of INTERNAL_HOST_PATTERNS) {
    if (pattern.test(hostname)) return true;
  }
  return false;
}

export async function maybeFetchOg(url: string): Promise<void> {
  try {
    const settings = await getSettings();
    if (settings.enableOgFetch !== true) return;

    // SSRF 防御：拒绝内网/私有地址
    let hostname = "";
    try { hostname = new URL(url).hostname; } catch { return; }
    if (hostname === "" || isInternalHostname(hostname)) return;

    const result = await chrome.storage.session.get("ogInFlight");
    const currentInFlight = (typeof result.ogInFlight === "number" ? result.ogInFlight : 0) ?? 0;
    if (currentInFlight >= OG_CONCURRENCY) return;

    const { getOgEntry, saveOgEntry } = await import("@/repositories");
    const existing = await getOgEntry(url);
    if (existing !== undefined && Date.now() - existing.fetchedAt < 7 * 86400_000) return;

    await chrome.storage.session.set({ ogInFlight: currentInFlight + 1 });
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), OG_TIMEOUT_MS);
      const resp = await fetch(url, {
        method: "GET",
        headers: { Range: `bytes=0-${OG_MAX_BYTES - 1}` },
        signal: controller.signal,
        redirect: "manual",
      });
      clearTimeout(timer);
      if (!resp.ok) return;
      const text = await resp.text();

      const ogMatch = /<meta[^>]+property\s*=\s*['"]og:description['"][^>]*content\s*=\s*['"]([^'"]*)['"]/i.exec(text);
      const descMatch = /<meta[^>]+name\s*=\s*['"]description['"][^>]*content\s*=\s*['"]([^'"]*)['"]/i.exec(text);
      const titleMatch = /<title>([^<]*)<\/title>/i.exec(text);
      const description = (ogMatch?.[1] ?? descMatch?.[1] ?? "").slice(0, 500);
      if (description === "") return;

      await saveOgEntry({
        url,
        title: titleMatch?.[1]?.slice(0, 200) ?? "",
        description,
        fetchedAt: Date.now(),
      });
    } finally {
      const updated = await chrome.storage.session.get("ogInFlight");
      const val = (typeof updated.ogInFlight === "number" ? updated.ogInFlight : 0) ?? 0;
      await chrome.storage.session.set({ ogInFlight: Math.max(0, val - 1) });
    }
  } catch { /* 静默 */ }
}
