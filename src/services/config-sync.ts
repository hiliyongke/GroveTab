/**
 * 轻量配置跨设备同步（opt-in，多键 last-write-wins）
 *
 * 设计原则：
 *   - **只同步「配置」，不同步「数据」**：settings（含快捷键）、功能开关、自动化规则、
 *     工作区模板、常用站点。标签页 / 归档 / 历史 / 书签元数据 / 缓存等大数据**绝不**进
 *     chrome.storage.sync（其总配额仅 ~100KB、单项 ≤8KB）。
 *   - **opt-in 且设备级**：每台设备独立决定是否开启（settingsSyncEnabled 不参与同步）。
 *   - **每键独立 last-write-wins**：每个配置键单独成一个 sync item，带自己的 updatedAt；
 *     启动时仅当远端比「本地已应用时间戳」更新才应用。每项独立，互不影响、互不撑爆配额。
 *   - **集中式推送**：通过 chrome.storage.onChanged 监听 local 变更，命中配置键即防抖推送，
 *     无需侵入各业务模块的写入路径。配合「回环抑制」避免拉取→写本地→又推送的死循环。
 *   - **优雅降级**：sync 不可用 / 单项超 8KB / 配额超限时静默跳过，绝不影响本地配置正确性。
 */

import {
  getStorageSync,
  setStorageSync,
  isStorageSyncAvailable,
} from "@/chrome/storage";
import { storageGet, storageSet, storageOnChanged } from "@/chrome";
import { STORAGE_KEYS } from "@/shared/config/storage-keys";
import { getSettings } from "@/repositories";
import { useSettingsStore } from "@/store/settings-slice";
import { useSpeedDialStore } from "@/store/speed-dial-slice";
import { useSmartSortStore } from "@/store/smart-sort-slice";
import { useFeatureFlagStore } from "@/shared/store/feature-flag-slice";
import type { SortWeights } from "@/features/smart-sort/types";

const SYNC_PAYLOAD_VERSION = 1;

/** 参与同步的配置键标识 */
export type ConfigKeyId =
  | "settings"
  | "featureFlags"
  | "automationRules"
  | "workspaceTemplates"
  | "speedDial"
  /** smart-sort：存于 localStorage（zustand persist），走 store-backed 特例分支 */
  | "smartSort";

interface SyncedConfig {
  id: ConfigKeyId;
  /** chrome.storage.local 原始键名 */
  localKey: string;
  /** 推送前转换（如剔除设备级字段） */
  transformOnPush?: (value: unknown) => unknown;
  /** 应用前转换（如还原设备级字段） */
  transformOnApply?: (value: unknown) => unknown;
}

function stripField(value: unknown, field: string): unknown {
  if (value === null || typeof value !== "object") return value;
  const clone: Record<string, unknown> = { ...(value as Record<string, unknown>) };
  delete clone[field];
  return clone;
}

const SYNCED_CONFIGS: readonly SyncedConfig[] = [
  {
    id: "settings",
    localKey: STORAGE_KEYS.settings,
    // settingsSyncEnabled 为设备级开关，不上传；应用远端时还原为本设备的开启态（=true）。
    transformOnPush: (v) => stripField(v, "settingsSyncEnabled"),
    transformOnApply: (v) =>
      v !== null && typeof v === "object"
        ? { ...(v as Record<string, unknown>), settingsSyncEnabled: true }
        : v,
  },
  { id: "featureFlags", localKey: STORAGE_KEYS.featureFlags },
  { id: "automationRules", localKey: STORAGE_KEYS.automationRules },
  { id: "workspaceTemplates", localKey: STORAGE_KEYS.workspaceTemplates },
  { id: "speedDial", localKey: STORAGE_KEYS.speedDial },
];

const CONFIG_BY_LOCAL_KEY = new Map(SYNCED_CONFIGS.map((c) => [c.localKey, c]));

interface SyncItemPayload {
  version: number;
  updatedAt: number;
  value: unknown;
}

/** sync item key = 命名空间前缀 + 配置 id */
function syncKeyOf(id: ConfigKeyId): string {
  return `${STORAGE_KEYS.settingsSync}:${id}`;
}

// ── 本地「已应用时间戳」标记（按 id） ──────────────────

async function getAppliedMap(): Promise<Record<string, number>> {
  const raw = await storageGet<Record<string, number>>(STORAGE_KEYS.settingsSyncApplied);
  return raw ?? {};
}

async function setAppliedAt(id: ConfigKeyId, ts: number): Promise<void> {
  const map = await getAppliedMap();
  map[id] = ts;
  await storageSet(STORAGE_KEYS.settingsSyncApplied, map);
}

// ── opt-in 开关（同步读取，来自 settings store） ────────

function isSyncEnabled(): boolean {
  return useSettingsStore.getState().settings.settingsSyncEnabled === true;
}

// ── 推送 ──────────────────────────────────────────────

/** 推送单个配置键到 sync。失败/不可用静默返回 false。 */
export async function pushConfigToSync(id: ConfigKeyId): Promise<boolean> {
  if (!isStorageSyncAvailable()) return false;
  const config = SYNCED_CONFIGS.find((c) => c.id === id);
  if (config === undefined) return false;

  const localValue = await storageGet<unknown>(config.localKey);
  if (localValue === undefined || localValue === null) return false;

  const value = config.transformOnPush ? config.transformOnPush(localValue) : localValue;
  const payload: SyncItemPayload = {
    version: SYNC_PAYLOAD_VERSION,
    updatedAt: Date.now(),
    value,
  };
  try {
    await setStorageSync({ [syncKeyOf(id)]: payload });
    await setAppliedAt(id, payload.updatedAt);
    return true;
  } catch (err) {
    // 单项超 8KB / 配额超限等：静默失败，本地配置不受影响。
    console.warn(`[config-sync] push "${id}" failed (可能超出 sync 配额)`, err);
    return false;
  }
}

// ── smart-sort（store-backed 特例：存于 localStorage，仅同步纯配置子集） ──
// pinnedTabIds / manualOverrides 是会话级 tab ID，跨设备无意义，故不同步。

interface SmartSortSyncValue {
  enabled: boolean;
  weights: SortWeights;
  decayRate: number;
}

/** 拉取应用 smart-sort 时抑制由 setState 触发的回环推送。 */
let suppressSmartSortPush = false;

function readSmartSortConfig(): SmartSortSyncValue {
  const s = useSmartSortStore.getState();
  return { enabled: s.enabled, weights: s.weights, decayRate: s.decayRate };
}

/** 推送 smart-sort 配置子集到 sync。 */
export async function pushSmartSortToSync(): Promise<boolean> {
  if (!isStorageSyncAvailable()) return false;
  const payload: SyncItemPayload = {
    version: SYNC_PAYLOAD_VERSION,
    updatedAt: Date.now(),
    value: readSmartSortConfig(),
  };
  try {
    await setStorageSync({ [syncKeyOf("smartSort")]: payload });
    await setAppliedAt("smartSort", payload.updatedAt);
    return true;
  } catch (err) {
    console.warn("[config-sync] push \"smartSort\" failed", err);
    return false;
  }
}

/** 把远端 smart-sort 配置应用到 store（持久化由 persist 自动完成）。 */
function applySmartSort(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  const v = value as Partial<SmartSortSyncValue>;
  const patch: Partial<SmartSortSyncValue> = {};
  if (typeof v.enabled === "boolean") patch.enabled = v.enabled;
  if (v.weights !== undefined && typeof v.weights === "object") patch.weights = v.weights;
  if (typeof v.decayRate === "number") patch.decayRate = v.decayRate;
  if (Object.keys(patch).length === 0) return;
  suppressSmartSortPush = true;
  try {
    useSmartSortStore.setState(patch);
  } finally {
    suppressSmartSortPush = false;
  }
}

/** 推送全部配置键（开启同步时的初次播种 / 重新断言本设备状态）。 */
export async function pushAllConfigToSync(): Promise<void> {
  for (const config of SYNCED_CONFIGS) {
    await pushConfigToSync(config.id);
  }
  await pushSmartSortToSync();
}

// ── 拉取 ──────────────────────────────────────────────

/**
 * 拉取全部配置键中「比本地已应用更新」的远端值并写回本地。
 * @returns 实际发生变更的配置 id 列表（供调用方回灌对应 store）。
 */
export async function pullAllConfigFromSync(): Promise<ConfigKeyId[]> {
  if (!isStorageSyncAvailable()) return [];

  const syncKeys = [...SYNCED_CONFIGS.map((c) => syncKeyOf(c.id)), syncKeyOf("smartSort")];
  const raw = await getStorageSync(syncKeys);
  const appliedMap = await getAppliedMap();
  const changed: ConfigKeyId[] = [];

  for (const config of SYNCED_CONFIGS) {
    const payload = raw[syncKeyOf(config.id)] as SyncItemPayload | undefined;
    if (
      payload === undefined ||
      typeof payload.updatedAt !== "number" ||
      payload.value === undefined
    ) {
      continue;
    }
    const appliedAt = appliedMap[config.id] ?? 0;
    if (payload.updatedAt <= appliedAt) continue;

    const value = config.transformOnApply ? config.transformOnApply(payload.value) : payload.value;
    // 抑制由本次写入触发的 onChanged，避免回环推送。
    suppressNextChange(config.localKey, value);
    await storageSet(config.localKey, value);
    appliedMap[config.id] = payload.updatedAt;
    changed.push(config.id);
  }

  // smart-sort（store-backed）：直接 setState 应用，无需写 chrome.storage.local。
  const ssPayload = raw[syncKeyOf("smartSort")] as SyncItemPayload | undefined;
  if (
    ssPayload !== undefined &&
    typeof ssPayload.updatedAt === "number" &&
    ssPayload.value !== undefined &&
    ssPayload.updatedAt > (appliedMap.smartSort ?? 0)
  ) {
    applySmartSort(ssPayload.value);
    appliedMap.smartSort = ssPayload.updatedAt;
    changed.push("smartSort");
  }

  if (changed.length > 0) {
    await storageSet(STORAGE_KEYS.settingsSyncApplied, appliedMap);
  }
  return changed;
}

/** 拉取后回灌受影响的 store，使 UI 立即反映同步结果。 */
export async function reloadStoresAfterPull(changed: ConfigKeyId[]): Promise<void> {
  if (changed.length === 0) return;
  const tasks: Promise<void>[] = [];
  // settings / automationRules / workspaceTemplates 均由 settings store 的 loadSettings 重新读取。
  if (
    changed.includes("settings") ||
    changed.includes("automationRules") ||
    changed.includes("workspaceTemplates")
  ) {
    tasks.push(useSettingsStore.getState().loadSettings());
  }
  if (changed.includes("featureFlags")) {
    tasks.push(useFeatureFlagStore.getState().loadFlags());
  }
  if (changed.includes("speedDial")) {
    tasks.push(useSpeedDialStore.getState().loadSites());
  }
  await Promise.all(tasks);
}

// ── 回环抑制 ──────────────────────────────────────────
// 拉取写本地会触发 onChanged；用「期望值」标记跳过这一次，避免再次推送。

const suppressed = new Map<string, string>();

function suppressNextChange(localKey: string, value: unknown): void {
  suppressed.set(localKey, JSON.stringify(value));
}

function consumeSuppressed(localKey: string, newValue: unknown): boolean {
  if (!suppressed.has(localKey)) return false;
  const expected = suppressed.get(localKey);
  if (expected === JSON.stringify(newValue)) {
    suppressed.delete(localKey);
    return true;
  }
  return false;
}

// ── onChanged 推送监听（防抖） ─────────────────────────

const pushTimers = new Map<ConfigKeyId, ReturnType<typeof setTimeout>>();
let storageUnsub: (() => void) | null = null;
let smartSortUnsub: (() => void) | null = null;

function schedulePush(id: ConfigKeyId, delayMs = 1500): void {
  const existing = pushTimers.get(id);
  if (existing !== undefined) clearTimeout(existing);
  pushTimers.set(
    id,
    setTimeout(() => {
      pushTimers.delete(id);
      if (id === "smartSort") void pushSmartSortToSync();
      else void pushConfigToSync(id);
    }, delayMs),
  );
}

/** 启动监听：chrome.storage.onChanged（storage 键）+ smart-sort store 订阅。幂等。 */
export function startConfigSyncWatcher(): void {
  if (storageUnsub === null) {
    storageUnsub = storageOnChanged((changes, areaName) => {
      if (areaName !== "local") return;
      if (!isSyncEnabled()) return;
      for (const localKey of Object.keys(changes)) {
        const config = CONFIG_BY_LOCAL_KEY.get(localKey);
        if (config === undefined) continue;
        const change = changes[localKey];
        // 回环抑制：本次变更是拉取写入造成的 → 跳过推送。
        if (consumeSuppressed(localKey, change?.newValue)) continue;
        if (change?.newValue === undefined) continue; // 删除不推送
        schedulePush(config.id);
      }
    });
  }

  if (smartSortUnsub === null) {
    let prev = JSON.stringify(readSmartSortConfig());
    smartSortUnsub = useSmartSortStore.subscribe(() => {
      if (!isSyncEnabled() || suppressSmartSortPush) return;
      const next = JSON.stringify(readSmartSortConfig());
      if (next === prev) return; // 仅配置子集变化才推送（忽略 pinned/override 等会话态）
      prev = next;
      schedulePush("smartSort");
    });
  }
}

/** 停止监听（测试 / 清理用）。 */
export function stopConfigSyncWatcher(): void {
  if (storageUnsub !== null) {
    storageUnsub();
    storageUnsub = null;
  }
  if (smartSortUnsub !== null) {
    smartSortUnsub();
    smartSortUnsub = null;
  }
}

// ── 启动初始化 ────────────────────────────────────────

/**
 * 应用启动时调用：若开启同步，拉取远端较新配置并回灌 store；随后启动监听。
 * @param options.seed 为 true 时（如刚开启同步）在拉取后把本设备配置整体推送一次，
 *   既能向其它设备播种，又能在采纳远端后重新断言合并结果。
 */
export async function initConfigSync(options?: { seed?: boolean }): Promise<void> {
  if (!isStorageSyncAvailable()) return;
  // 用 repo 直读 storage 判断开关，避免依赖 settings store 的加载时序。
  const enabled = (await getSettings()).settingsSyncEnabled === true;
  if (!enabled) return;
  try {
    const changed = await pullAllConfigFromSync();
    await reloadStoresAfterPull(changed);
    if (options?.seed === true) {
      await pushAllConfigToSync();
    }
  } catch (err) {
    console.warn("[config-sync] init failed", err);
  } finally {
    startConfigSyncWatcher();
  }
}
