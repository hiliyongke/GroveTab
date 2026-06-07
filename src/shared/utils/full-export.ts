/**
 * full-export — 全量数据导出/导入
 *
 * 使用 chrome.storage.local.get(null) 读取全部 key，确保不遗漏任何数据。
 * 导出时排除瞬态 key（tabs/undo），其余全部打包。
 */

import { useSettingsStore } from "@/store";
import type { UserSettings, SpeedDialSite } from "@/shared/types";
import { STORAGE_KEYS } from "@/shared/config/storage-keys";
import { translate } from "@/shared/i18n/core";

/** 不对用户导出的瞬态 key（无需备份的运行时数据） */
const SKIP_KEYS = new Set([
  STORAGE_KEYS.tabs,            // 实时标签页，每次打开重新拉取
  STORAGE_KEYS.undo,            // 撤销暂存，重启失效
]);

export interface FullExportBundle {
  version: 1;
  exportedAt: string;
  appName: string;
  /** 结构化数据（便于查看/修复） */
  settings: UserSettings;
  speedDialSites: SpeedDialSite[];
  featureFlags: Record<string, boolean>;
  /** 全部原始 storage 数据（排除瞬态 key） */
  storage: Record<string, unknown>;
  /** localStorage 数据 */
  localStorage: Record<string, string>;
}

/** 导出全量数据 */
export async function exportFullBundle(): Promise<string> {
  const settings = useSettingsStore.getState().settings;

  // 读取全部 chrome.storage.local
  const allRaw = await chrome.storage.local.get(null);

  // 过滤掉瞬态 key
  const storage: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(allRaw)) {
    if (!SKIP_KEYS.has(k as never)) {
      storage[k] = v;
    }
  }

  // 提取结构化数据（便于 JSON 阅读和修复）
  const speedDialSites = (storage[STORAGE_KEYS.speedDial] as SpeedDialSite[]) || [];
  const featureFlags = (storage[STORAGE_KEYS.featureFlags] as Record<string, boolean>) || {};

  // 读取 localStorage
  const localStore: Record<string, string> = {};
  try {
    const gLs = globalThis.localStorage;
    if (gLs) {
      const eng = gLs.getItem("grove:search:lastEngine");
      if (eng) localStore["grove:search:lastEngine"] = eng;
      const theme = gLs.getItem("app_prepaint_theme");
      if (theme) localStore["app_prepaint_theme"] = theme;
    }
  } catch { /* unavailable */ }

  const bundle: FullExportBundle = {
    version: 1,
    exportedAt: new Date().toISOString(),
    appName: "GroveTab",
    settings,
    speedDialSites,
    featureFlags,
    storage,
    localStorage: localStore,
  };

  return JSON.stringify(bundle, null, 2);
}

/** 合并数组（按 id 去重） */
function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const ids = new Set(existing.map((e) => e.id));
  return [...existing, ...incoming.filter((i) => !ids.has(i.id))];
}

/** 全量导入 */
export async function importFullBundle(json: string): Promise<{
  restored: string[];
  skipped: string[];
  errors: string[];
}> {
  const restored: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  let bundle: FullExportBundle;
  try {
    bundle = JSON.parse(json) as FullExportBundle;
  } catch {
    throw new Error(translate("JSON 格式无效"));
  }
  if (!bundle || typeof bundle !== "object") throw new Error(translate("数据格式不兼容"));

  // 1. Settings
  if (bundle.settings) {
    try {
      await useSettingsStore.getState().updateSettings(bundle.settings as UserSettings);
      restored.push(translate("设置"));
    } catch { errors.push(translate("设置导入失败")); }
  } else skipped.push(translate("设置"));

  // 2. SpeedDial（合并去重）
  if (Array.isArray(bundle.speedDialSites) && bundle.speedDialSites.length > 0) {
    const raw = await chrome.storage.local.get(STORAGE_KEYS.speedDial);
    const existing = (raw[STORAGE_KEYS.speedDial] as SpeedDialSite[]) || [];
    const urls = new Set(existing.map((s) => s.url.toLowerCase().replace(/\/+$/, "")));
    const toAdd = bundle.speedDialSites.filter((s) => !urls.has(s.url.toLowerCase().replace(/\/+$/, "")));
    if (toAdd.length > 0) {
      await chrome.storage.local.set({ [STORAGE_KEYS.speedDial]: [...existing, ...toAdd] });
      restored.push(translate("常用站点 (+{count})", { count: toAdd.length }));
    } else skipped.push(translate("常用站点（全部已存在）"));
  } else skipped.push(translate("常用站点"));

  // 3. Feature Flags
  if (bundle.featureFlags && Object.keys(bundle.featureFlags).length > 0) {
    const raw = await chrome.storage.local.get(STORAGE_KEYS.featureFlags);
    await chrome.storage.local.set({
      [STORAGE_KEYS.featureFlags]: { ...(raw[STORAGE_KEYS.featureFlags] as object || {}), ...bundle.featureFlags },
    });
    restored.push(translate("功能开关"));
  }

  // 4. Storage 批量恢复（合并模式，不覆盖已有数据）
  if (bundle.storage && typeof bundle.storage === "object") {
    const existingAll = await chrome.storage.local.get(null);
    const toSet: Record<string, unknown> = {};
    let rawCount = 0;

    for (const [k, v] of Object.entries(bundle.storage)) {
      if (SKIP_KEYS.has(k as never)) continue;
      // speedDial 和 sessions 已在上方/下方单独按 id 合并
      if (k === STORAGE_KEYS.speedDial || k === STORAGE_KEYS.sessions) continue;
      if (v === undefined || v === null) continue;

      const cur = existingAll[k];
      // 数组：合并（保留已有元素 + 追加新元素）
      if (Array.isArray(v) && Array.isArray(cur)) {
        toSet[k] = [...cur, ...v];
      }
      // 对象：浅合并
      else if (typeof v === "object" && !Array.isArray(v) && typeof cur === "object" && !Array.isArray(cur)) {
        toSet[k] = { ...cur, ...v };
      }
      // 已有数据 → 跳过，不覆盖
      else if (cur !== undefined) {
        continue;
      }
      // 无已有数据 → 写入
      else {
        toSet[k] = v;
      }
      rawCount++;
    }

    if (rawCount > 0) {
      await chrome.storage.local.set(toSet);
      restored.push(translate("存储数据 ({count} 项 )", { count: rawCount }));
    }
  }

  // 5. Archive Sessions（按 id 合并）
  if (bundle.storage?.[STORAGE_KEYS.sessions]) {
    const incoming = bundle.storage[STORAGE_KEYS.sessions] as { id: string }[];
    if (Array.isArray(incoming) && incoming.length > 0) {
      const raw = await chrome.storage.local.get(STORAGE_KEYS.sessions);
      const existing = (raw[STORAGE_KEYS.sessions] as { id: string }[]) || [];
      const merged = mergeById(existing, incoming);
      const added = merged.length - existing.length;
      if (added > 0) {
        await chrome.storage.local.set({ [STORAGE_KEYS.sessions]: merged });
        restored.push(translate("归档会话 (+{count})", { count: added }));
      }
    }
  }

  // 6. localStorage 恢复
  if (bundle.localStorage && typeof bundle.localStorage === "object") {
    for (const [k, v] of Object.entries(bundle.localStorage)) {
      if (v) localStorage.setItem(k, v);
    }
    restored.push(translate("本地缓存"));
  }

  return { restored, skipped, errors };
}

/** 下载 JSON 文件 */
export function downloadJsonFile(json: string, filename: string): void {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
