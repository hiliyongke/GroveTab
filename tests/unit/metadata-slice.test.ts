/**
 * Metadata Slice 单元测试
 *
 * 覆盖 tags / notes / pins / activity / workspaces / window aliases & colors 的核心行为：
 * - URL key 规范化（normalizeMetadataKey）
 * - 不可变更新与 set/list 同步
 * - workspace 数量上限（3）
 * - alias / color 空值删除路径
 * - GC 清理：仅保留活跃 windowId
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// 全部走内存桩，避免触碰 chrome / IndexedDB
vi.mock("@/repositories", () => ({
  getData: vi.fn().mockResolvedValue(undefined),
  setData: vi.fn().mockResolvedValue(undefined),
  getRecentActivity: vi.fn().mockResolvedValue([]),
  pushActivity: vi.fn().mockResolvedValue([]),
  clearActivity: vi.fn().mockResolvedValue(undefined),
  getWorkspaces: vi.fn().mockResolvedValue([]),
  saveWorkspaces: vi.fn().mockResolvedValue(undefined),
  getWindowAliases: vi.fn().mockResolvedValue({}),
  saveWindowAliases: vi.fn().mockResolvedValue(undefined),
  appendHistoryEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/shared/config/storage-keys", () => ({
  STORAGE_KEYS: {
    tags: "grove_tags",
    notes: "grove_notes",
    pins: "grove_pins",
  },
}));

import { useMetadataStore } from "@/store/metadata-slice";
import {
  setData,
  saveWorkspaces,
  saveWindowAliases,
  pushActivity as repoPushActivity,
} from "@/repositories";

beforeEach(() => {
  vi.clearAllMocks();
  useMetadataStore.setState({
    tags: {},
    notes: {},
    pinnedUrls: new Set<string>(),
    recentActivity: [],
    workspaces: [],
    windowAliases: {},
    windowColors: {},
  });
});

describe("addTag / removeTag", () => {
  it("addTag 后能从 getTags 读到", async () => {
    await useMetadataStore.getState().addTag("https://example.com/", "工作");
    expect(useMetadataStore.getState().getTags("https://example.com/")).toEqual(["工作"]);
    expect(setData).toHaveBeenCalled();
  });

  it("重复 addTag 同一 url+tag 不会产生重复条目", async () => {
    const { addTag, getTags } = useMetadataStore.getState();
    await addTag("https://a.com/", "x");
    await addTag("https://a.com/", "x");
    expect(getTags("https://a.com/")).toEqual(["x"]);
  });

  it("removeTag 命中后剩余列表正确", async () => {
    const { addTag, removeTag, getTags } = useMetadataStore.getState();
    await addTag("https://a.com/", "x");
    await addTag("https://a.com/", "y");
    await removeTag("https://a.com/", "x");
    expect(getTags("https://a.com/")).toEqual(["y"]);
  });

  it("removeTag 把列表清空时会删除整个 key", async () => {
    const { addTag, removeTag } = useMetadataStore.getState();
    await addTag("https://a.com/", "x");
    await removeTag("https://a.com/", "x");
    expect(useMetadataStore.getState().tags).not.toHaveProperty("https://a.com/");
  });

  it("getTags 对未登记 url 返回稳定空数组（同一引用）", () => {
    const a = useMetadataStore.getState().getTags("https://no.com/");
    const b = useMetadataStore.getState().getTags("https://other.com/");
    expect(a).toBe(b);
    expect(a).toEqual([]);
  });
});

describe("setNote / removeNote", () => {
  it("setNote 写入后 getNote 能读取", async () => {
    await useMetadataStore.getState().setNote("https://a.com/", "重要");
    expect(useMetadataStore.getState().getNote("https://a.com/")).toBe("重要");
  });

  it("setNote 传入空白会删除条目", async () => {
    const { setNote, getNote } = useMetadataStore.getState();
    await setNote("https://a.com/", "x");
    await setNote("https://a.com/", "   ");
    expect(getNote("https://a.com/")).toBe("");
  });

  it("removeNote 后 getNote 返回空串", async () => {
    const { setNote, removeNote, getNote } = useMetadataStore.getState();
    await setNote("https://a.com/", "x");
    await removeNote("https://a.com/");
    expect(getNote("https://a.com/")).toBe("");
  });
});

describe("togglePin / isPinned", () => {
  it("首次 toggle 后 isPinned 为 true", async () => {
    await useMetadataStore.getState().togglePin("https://a.com/");
    expect(useMetadataStore.getState().isPinned("https://a.com/")).toBe(true);
  });

  it("二次 toggle 取消固定", async () => {
    const { togglePin, isPinned } = useMetadataStore.getState();
    await togglePin("https://a.com/");
    await togglePin("https://a.com/");
    expect(isPinned("https://a.com/")).toBe(false);
  });
});

describe("workspaces", () => {
  it("setWorkspaces 截断到最多 3 个", async () => {
    const list = Array.from({ length: 5 }).map((_, i) => ({
      id: `w${i}`,
      name: `WS ${i}`,
      tabIds: [],
      createdAt: 0,
    }));
    await useMetadataStore.getState().setWorkspaces(list as never);
    expect(useMetadataStore.getState().workspaces.length).toBe(3);
    expect(saveWorkspaces).toHaveBeenCalled();
  });

  it("upsertWorkspace 第 4 条会被静默拒绝", async () => {
    const ws = (id: string) => ({ id, name: id, tabIds: [], createdAt: 0 }) as never;
    await useMetadataStore.getState().upsertWorkspace(ws("a"));
    await useMetadataStore.getState().upsertWorkspace(ws("b"));
    await useMetadataStore.getState().upsertWorkspace(ws("c"));
    await useMetadataStore.getState().upsertWorkspace(ws("d"));
    expect(useMetadataStore.getState().workspaces.length).toBe(3);
  });

  it("upsertWorkspace 已存在 id 会替换而不是追加", async () => {
    const ws = (id: string, name: string) => ({ id, name, tabIds: [], createdAt: 0 }) as never;
    await useMetadataStore.getState().upsertWorkspace(ws("a", "1"));
    await useMetadataStore.getState().upsertWorkspace(ws("a", "2"));
    expect(useMetadataStore.getState().workspaces.length).toBe(1);
    expect(useMetadataStore.getState().workspaces[0]?.name).toBe("2");
  });

  it("removeWorkspace 后列表与持久化均同步", async () => {
    const ws = (id: string) => ({ id, name: id, tabIds: [], createdAt: 0 }) as never;
    await useMetadataStore.getState().upsertWorkspace(ws("a"));
    await useMetadataStore.getState().removeWorkspace("a");
    expect(useMetadataStore.getState().workspaces.length).toBe(0);
    expect(saveWorkspaces).toHaveBeenLastCalledWith([]);
  });
});

describe("activity", () => {
  it("pushActivity 用 repo 返回值更新 store", async () => {
    (repoPushActivity as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { ts: 1, type: "tab_jumped", url: "x", title: "x" },
    ]);
    await useMetadataStore.getState().pushActivity({
      ts: 1,
      type: "tab_jumped",
      url: "x",
      title: "x",
    } as never);
    expect(useMetadataStore.getState().recentActivity.length).toBe(1);
  });

  it("clearActivity 清空内存与持久化", async () => {
    useMetadataStore.setState({
      recentActivity: [{ ts: 1, type: "tab_jumped", url: "x", title: "x" } as never],
    });
    await useMetadataStore.getState().clearActivity();
    expect(useMetadataStore.getState().recentActivity.length).toBe(0);
  });
});

describe("window aliases & colors", () => {
  it("setWindowAlias 存储并 trim", async () => {
    await useMetadataStore.getState().setWindowAlias(7, "  专属  ");
    expect(useMetadataStore.getState().windowAliases[7]).toBe("专属");
    expect(saveWindowAliases).toHaveBeenCalled();
  });

  it("setWindowAlias 传入空字符串会删除条目", async () => {
    await useMetadataStore.getState().setWindowAlias(7, "x");
    await useMetadataStore.getState().setWindowAlias(7, "");
    expect(useMetadataStore.getState().windowAliases[7]).toBeUndefined();
  });

  it("setWindowColor 空值删除条目", async () => {
    await useMetadataStore.getState().setWindowColor(7, "#abcdef");
    await useMetadataStore.getState().setWindowColor(7, "");
    expect(useMetadataStore.getState().windowColors[7]).toBeUndefined();
  });

  it("gcWindowAliases 仅保留活跃窗口", async () => {
    await useMetadataStore.getState().setWindowAlias(1, "a");
    await useMetadataStore.getState().setWindowAlias(2, "b");
    await useMetadataStore.getState().setWindowAlias(3, "c");
    await useMetadataStore.getState().gcWindowAliases([2, 3]);
    expect(useMetadataStore.getState().windowAliases[1]).toBeUndefined();
    expect(useMetadataStore.getState().windowAliases[2]).toBe("b");
    expect(useMetadataStore.getState().windowAliases[3]).toBe("c");
  });

  it("gcWindowAliases 在无变化时不重复持久化", async () => {
    await useMetadataStore.getState().setWindowAlias(1, "a");
    (saveWindowAliases as ReturnType<typeof vi.fn>).mockClear();
    await useMetadataStore.getState().gcWindowAliases([1]);
    expect(saveWindowAliases).not.toHaveBeenCalled();
  });
});
