/**
 * Smart Sort Slice 单元测试
 *
 * 覆盖：
 * - 权重 / decayRate / enabled 三套 setter
 * - 置顶 add / remove / toggle / clear / isPinned
 * - manualOverrides set / remove / clear / get（同 tabId 去重）
 * - resetToDefaults 还原
 *
 * 仅做内存层面验证，persist 中间件由 zustand 自身保证。
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/shared/config/storage-keys", () => ({
  STORAGE_KEYS: { smartSort: "grove_smart_sort" },
}));

/**
 * 跳过 zustand persist：store 创建时会依赖 localStorage，但该测试只关心内存状态变化。
 * 用 identity wrapper 替换 persist，让中间件接口变为透明。
 */
vi.mock("zustand/middleware", async () => {
  const actual = await vi.importActual<typeof import("zustand/middleware")>("zustand/middleware");
  return {
    ...actual,
    persist: (config: unknown) => config,
  };
});

import { useSmartSortStore } from "@/store/smart-sort-slice";
import { DEFAULT_WEIGHTS, DEFAULT_SMART_SORT_CONFIG } from "@/features/smart-sort/types";

beforeEach(() => {
  useSmartSortStore.setState({
    enabled: DEFAULT_SMART_SORT_CONFIG.enabled,
    weights: { ...DEFAULT_WEIGHTS },
    decayRate: DEFAULT_SMART_SORT_CONFIG.decayRate,
    pinnedTabIds: [],
    manualOverrides: [],
    loaded: false,
  });
});

describe("config setters", () => {
  it("setEnabled 切换 enabled", () => {
    useSmartSortStore.getState().setEnabled(true);
    expect(useSmartSortStore.getState().enabled).toBe(true);
  });

  it("setWeights 整体替换", () => {
    const next = { recency: 1, frequency: 0, time: 0, domain: 0, manual: 0 };
    useSmartSortStore.getState().setWeights(next);
    expect(useSmartSortStore.getState().weights).toEqual(next);
  });

  it("updateWeight 仅更新单个维度", () => {
    useSmartSortStore.getState().updateWeight("recency", 0.42);
    const w = useSmartSortStore.getState().weights;
    expect(w.recency).toBe(0.42);
    expect(w.frequency).toBe(DEFAULT_WEIGHTS.frequency);
  });

  it("setDecayRate 写入新值", () => {
    useSmartSortStore.getState().setDecayRate(0.5);
    expect(useSmartSortStore.getState().decayRate).toBe(0.5);
  });

  it("resetToDefaults 同时还原权重与衰减", () => {
    const s = useSmartSortStore.getState();
    s.updateWeight("recency", 0.99);
    s.setDecayRate(0.99);
    s.resetToDefaults();
    expect(useSmartSortStore.getState().weights).toEqual(DEFAULT_WEIGHTS);
    expect(useSmartSortStore.getState().decayRate).toBe(DEFAULT_SMART_SORT_CONFIG.decayRate);
  });
});

describe("pinned tabs", () => {
  it("addPinnedTab 后 isPinned=true", () => {
    useSmartSortStore.getState().addPinnedTab(1);
    expect(useSmartSortStore.getState().isPinned(1)).toBe(true);
  });

  it("重复 add 同一 tabId 不会重复", () => {
    useSmartSortStore.getState().addPinnedTab(1);
    useSmartSortStore.getState().addPinnedTab(1);
    expect(useSmartSortStore.getState().pinnedTabIds.length).toBe(1);
  });

  it("removePinnedTab 后该 id 消失", () => {
    useSmartSortStore.getState().addPinnedTab(1);
    useSmartSortStore.getState().removePinnedTab(1);
    expect(useSmartSortStore.getState().isPinned(1)).toBe(false);
  });

  it("togglePinnedTab 在 add/remove 之间切换", () => {
    const s = useSmartSortStore.getState();
    s.togglePinnedTab(2);
    expect(s.isPinned(2)).toBe(true);
    s.togglePinnedTab(2);
    expect(useSmartSortStore.getState().isPinned(2)).toBe(false);
  });

  it("clearPinnedTabs 清空全部置顶", () => {
    const s = useSmartSortStore.getState();
    s.addPinnedTab(1);
    s.addPinnedTab(2);
    s.clearPinnedTabs();
    expect(useSmartSortStore.getState().pinnedTabIds).toEqual([]);
  });
});

describe("manual overrides", () => {
  it("setManualOverride 写入并能被 getManualOverride 取回", () => {
    useSmartSortStore.getState().setManualOverride(7, 0.5);
    expect(useSmartSortStore.getState().getManualOverride(7)).toBe(0.5);
  });

  it("再次 setManualOverride 同一 tabId 替换分值", () => {
    const s = useSmartSortStore.getState();
    s.setManualOverride(7, 0.3);
    s.setManualOverride(7, 0.8);
    expect(useSmartSortStore.getState().manualOverrides.length).toBe(1);
    expect(useSmartSortStore.getState().getManualOverride(7)).toBe(0.8);
  });

  it("removeManualOverride 删除指定 tabId", () => {
    const s = useSmartSortStore.getState();
    s.setManualOverride(1, 0.1);
    s.setManualOverride(2, 0.2);
    s.removeManualOverride(1);
    expect(useSmartSortStore.getState().getManualOverride(1)).toBeUndefined();
    expect(useSmartSortStore.getState().getManualOverride(2)).toBe(0.2);
  });

  it("clearManualOverrides 清空全部", () => {
    const s = useSmartSortStore.getState();
    s.setManualOverride(1, 0.1);
    s.setManualOverride(2, 0.2);
    s.clearManualOverrides();
    expect(useSmartSortStore.getState().manualOverrides).toEqual([]);
  });

  it("getManualOverride 对未登记 id 返回 undefined", () => {
    expect(useSmartSortStore.getState().getManualOverride(999)).toBeUndefined();
  });
});
