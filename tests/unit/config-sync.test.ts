/**
 * config-sync 单元测试
 *
 * 覆盖：单键 push + appliedAt 标记、多键 pull 的 last-write-wins、settings 设备级字段
 * 的剔除/还原、sync 不可用降级。
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/shared/config/storage-keys", () => ({
  STORAGE_KEYS: {
    settings: "k_settings",
    featureFlags: "k_flags",
    automationRules: "k_auto",
    workspaceTemplates: "k_tpl",
    speedDial: "k_speeddial",
    settingsSync: "k_sync",
    settingsSyncApplied: "k_sync_applied",
  },
}));

// ── 内存版 chrome 存储 ──
const localStore: Record<string, unknown> = {};
const syncStore: Record<string, unknown> = {};
let syncAvailable = true;

vi.mock("@/chrome/storage", () => ({
  isStorageSyncAvailable: () => syncAvailable,
  getStorageSync: async (keys: string | string[] | null) => {
    const out: Record<string, unknown> = {};
    const list = Array.isArray(keys) ? keys : keys === null ? Object.keys(syncStore) : [keys];
    for (const k of list) if (k in syncStore) out[k] = syncStore[k];
    return out;
  },
  setStorageSync: async (items: Record<string, unknown>) => {
    Object.assign(syncStore, items);
  },
}));

vi.mock("@/chrome", () => ({
  storageGet: async (key: string) => localStore[key],
  storageSet: async (key: string, value: unknown) => {
    localStore[key] = value;
  },
  storageOnChanged: () => () => {},
}));

vi.mock("@/repositories", () => ({
  getSettings: async () => (localStore["k_settings"] as object) ?? {},
}));

// store mocks（仅 getState().loadXxx + settings 开关）
const loadSettings = vi.fn().mockResolvedValue(undefined);
const loadFlags = vi.fn().mockResolvedValue(undefined);
const loadSites = vi.fn().mockResolvedValue(undefined);

vi.mock("@/store/settings-slice", () => ({
  useSettingsStore: {
    getState: () => ({
      settings: { settingsSyncEnabled: true },
      loadSettings,
    }),
  },
}));
vi.mock("@/store/speed-dial-slice", () => ({
  useSpeedDialStore: { getState: () => ({ loadSites }) },
}));
vi.mock("@/shared/store/feature-flag-slice", () => ({
  useFeatureFlagStore: { getState: () => ({ loadFlags }) },
}));

// smart-sort store mock（store-backed 源）
let smartSortState = { enabled: false, weights: { recency: 1 }, decayRate: 0.5 };
const smartSetState = vi.fn((patch: Partial<typeof smartSortState>) => {
  smartSortState = { ...smartSortState, ...patch };
});
vi.mock("@/store/smart-sort-slice", () => ({
  useSmartSortStore: {
    getState: () => smartSortState,
    setState: (patch: Partial<typeof smartSortState>) => smartSetState(patch),
    subscribe: () => () => {},
  },
}));

import {
  pushConfigToSync,
  pushSmartSortToSync,
  pullAllConfigFromSync,
  reloadStoresAfterPull,
} from "@/services/config-sync";

interface Payload {
  version: number;
  updatedAt: number;
  value: unknown;
}

beforeEach(() => {
  for (const k of Object.keys(localStore)) delete localStore[k];
  for (const k of Object.keys(syncStore)) delete syncStore[k];
  syncAvailable = true;
  loadSettings.mockClear();
  loadFlags.mockClear();
  loadSites.mockClear();
  smartSetState.mockClear();
  smartSortState = { enabled: false, weights: { recency: 1 }, decayRate: 0.5 };
});

describe("pushConfigToSync", () => {
  it("写入对应 sync item 并标记 appliedAt", async () => {
    localStore["k_flags"] = { betaX: true };
    const ok = await pushConfigToSync("featureFlags");
    expect(ok).toBe(true);

    const payload = syncStore["k_sync:featureFlags"] as Payload;
    expect(payload.value).toEqual({ betaX: true });
    const applied = localStore["k_sync_applied"] as Record<string, number>;
    expect(applied.featureFlags).toBe(payload.updatedAt);
  });

  it("settings 推送时剔除设备级 settingsSyncEnabled", async () => {
    localStore["k_settings"] = { theme: "dark", settingsSyncEnabled: true };
    await pushConfigToSync("settings");
    const payload = syncStore["k_sync:settings"] as Payload;
    expect("settingsSyncEnabled" in (payload.value as object)).toBe(false);
    expect((payload.value as { theme: string }).theme).toBe("dark");
  });

  it("本地无值时不推送", async () => {
    const ok = await pushConfigToSync("speedDial");
    expect(ok).toBe(false);
    expect(syncStore["k_sync:speedDial"]).toBeUndefined();
  });

  it("sync 不可用时返回 false", async () => {
    syncAvailable = false;
    localStore["k_flags"] = { a: true };
    expect(await pushConfigToSync("featureFlags")).toBe(false);
  });
});

describe("pullAllConfigFromSync", () => {
  it("应用更新的远端键并返回变更列表", async () => {
    syncStore["k_sync:featureFlags"] = {
      version: 1,
      updatedAt: Date.now() + 10_000,
      value: { betaX: true },
    } satisfies Payload;
    syncStore["k_sync:speedDial"] = {
      version: 1,
      updatedAt: Date.now() + 10_000,
      value: [{ id: "1", url: "https://a.com", title: "A", order: 0 }],
    } satisfies Payload;

    const changed = await pullAllConfigFromSync();
    expect(changed.sort()).toEqual(["featureFlags", "speedDial"]);
    expect(localStore["k_flags"]).toEqual({ betaX: true });
    expect((localStore["k_sync_applied"] as Record<string, number>).featureFlags).toBeGreaterThan(0);
  });

  it("settings 应用时还原设备级 settingsSyncEnabled=true", async () => {
    syncStore["k_sync:settings"] = {
      version: 1,
      updatedAt: Date.now() + 10_000,
      value: { theme: "light" },
    } satisfies Payload;

    const changed = await pullAllConfigFromSync();
    expect(changed).toContain("settings");
    expect(localStore["k_settings"]).toEqual({ theme: "light", settingsSyncEnabled: true });
  });

  it("远端不比已应用更新时跳过", async () => {
    localStore["k_sync_applied"] = { featureFlags: 5000 };
    syncStore["k_sync:featureFlags"] = { version: 1, updatedAt: 5000, value: { a: true } } satisfies Payload;
    const changed = await pullAllConfigFromSync();
    expect(changed).not.toContain("featureFlags");
  });

  it("sync 不可用时返回空", async () => {
    syncAvailable = false;
    syncStore["k_sync:featureFlags"] = { version: 1, updatedAt: Date.now() + 1, value: { a: true } } satisfies Payload;
    expect(await pullAllConfigFromSync()).toEqual([]);
  });
});

describe("smart-sort（store-backed）", () => {
  it("pushSmartSortToSync 只推送配置子集", async () => {
    smartSortState = { enabled: true, weights: { recency: 2 }, decayRate: 0.3 };
    const ok = await pushSmartSortToSync();
    expect(ok).toBe(true);
    const payload = syncStore["k_sync:smartSort"] as Payload;
    expect(payload.value).toEqual({ enabled: true, weights: { recency: 2 }, decayRate: 0.3 });
  });

  it("pull 应用远端 smart-sort 到 store（setState）", async () => {
    syncStore["k_sync:smartSort"] = {
      version: 1,
      updatedAt: Date.now() + 10_000,
      value: { enabled: true, weights: { recency: 9 }, decayRate: 0.9 },
    } satisfies Payload;
    const changed = await pullAllConfigFromSync();
    expect(changed).toContain("smartSort");
    expect(smartSetState).toHaveBeenCalledWith({
      enabled: true,
      weights: { recency: 9 },
      decayRate: 0.9,
    });
  });
});

describe("reloadStoresAfterPull", () => {
  it("settings/automation/template 变更 → 重载 settings store", async () => {
    await reloadStoresAfterPull(["automationRules"]);
    expect(loadSettings).toHaveBeenCalledTimes(1);
  });

  it("featureFlags / speedDial 变更 → 各自重载", async () => {
    await reloadStoresAfterPull(["featureFlags", "speedDial"]);
    expect(loadFlags).toHaveBeenCalledTimes(1);
    expect(loadSites).toHaveBeenCalledTimes(1);
  });

  it("空变更不触发重载", async () => {
    await reloadStoresAfterPull([]);
    expect(loadSettings).not.toHaveBeenCalled();
    expect(loadFlags).not.toHaveBeenCalled();
    expect(loadSites).not.toHaveBeenCalled();
  });
});
