/**
 * Undo Slice 单元测试
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock 外部依赖
vi.mock("@/repositories", () => ({
  getData: vi.fn().mockResolvedValue([]),
  setData: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/chrome", () => ({
  createTab: vi.fn().mockResolvedValue({ id: 999 }),
  getCurrentWindow: vi.fn().mockResolvedValue({ id: 1 }),
}));

vi.mock("@/shared/ui/feedback", () => ({
  feedback: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/shared/i18n/core", () => ({
  translate: vi.fn((key: string) => key),
}));

vi.mock("@/shared/utils/url-safety", () => ({
  filterSafeExternalUrls: vi.fn((urls: string[]) => urls),
}));

vi.mock("@/shared/config/brand", () => ({
  BRAND: { logTag: "[Grove]" },
}));

vi.mock("@/shared/config/storage-keys", () => ({
  STORAGE_KEYS: { undo: "grove_undo" },
}));

vi.mock("@/services/archive", () => ({
  saveSessions: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/store/sessions-slice", () => ({
  useSessionsStore: {
    getState: vi.fn(() => ({
      refreshSessions: vi.fn().mockResolvedValue(undefined),
    })),
  },
}));

vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "testid01"),
}));

// Mock settings store
vi.mock("@/store/settings-slice", () => ({
  useSettingsStore: {
    getState: vi.fn(() => ({
      settings: { undoWindowSeconds: 5 },
    })),
  },
}));

import { useUndoStore } from "@/store/undo-slice";
import { getData, setData } from "@/repositories";
import { saveSessions } from "@/services/archive";
import type { ArchivedSession, ClosedTabSnapshot, UndoRecord } from "@/shared/types";

const mkTab = (url: string, title = url): ClosedTabSnapshot => ({
  url,
  title,
  favIconUrl: "",
  windowId: 1,
  pinned: false,
});

const mkSession = (id: string): ArchivedSession => ({
  id,
  name: `session-${id}`,
  createdAt: Date.now(),
  tabs: [],
  tabCount: 0,
});

beforeEach(() => {
  vi.clearAllMocks();
  useUndoStore.setState({
    records: [],
    activeToast: null,
  });
});

describe("addRecord", () => {
  it("添加撤销记录", async () => {
    const tabs = [mkTab("https://a.com")];
    const record = await useUndoStore.getState().addRecord(tabs, "closed 1 tab");
    expect(record.tabs).toEqual(tabs);
    expect(record.description).toBe("closed 1 tab");
    expect(record.expired).toBe(false);
    expect(record.id).toBe("testid01");
  });

  it("添加记录后 records 列表更新", async () => {
    const tabs = [mkTab("https://a.com")];
    await useUndoStore.getState().addRecord(tabs, "closed 1 tab");
    expect(useUndoStore.getState().records.length).toBe(1);
  });

  it("添加记录后 activeToast 为最新记录", async () => {
    const tabs = [mkTab("https://a.com")];
    const record = await useUndoStore.getState().addRecord(tabs, "test");
    expect(useUndoStore.getState().activeToast?.id).toBe(record.id);
  });

  it("添加记录会持久化到 storage", async () => {
    const tabs = [mkTab("https://a.com")];
    await useUndoStore.getState().addRecord(tabs, "test");
    expect(setData).toHaveBeenCalled();
  });

  it("记录数量限制为 5 条（MAX_UNDO_RECORDS）", async () => {
    // 添加 7 条记录
    for (let i = 0; i < 7; i++) {
      const { nanoid } = await import("nanoid");
      (nanoid as ReturnType<typeof vi.fn>).mockReturnValueOnce(`id${i}`);
      await useUndoStore.getState().addRecord([mkTab(`https://${i}.com`)], `tab ${i}`);
    }
    expect(useUndoStore.getState().records.length).toBe(5);
    // 最新的在前
    expect(useUndoStore.getState().records[0].id).toBe("id6");
  });
});

describe("addSessionSnapshotRecord", () => {
  it("添加会话快照撤销记录", async () => {
    const sessions = [mkSession("s1")];
    const record = await useUndoStore
      .getState()
      .addSessionSnapshotRecord(sessions, "deleted session");
    expect(record.kind).toBe("sessions_snapshot");
    expect(record.sessionsSnapshot).toEqual(sessions);
    expect(record.description).toBe("deleted session");
    expect(useUndoStore.getState().activeToast?.id).toBe(record.id);
  });
});

describe("undoRecord", () => {
  it("撤销操作后记录被移除", async () => {
    const tabs = [mkTab("https://a.com")];
    const record = await useUndoStore.getState().addRecord(tabs, "test");
    await useUndoStore.getState().undoRecord(record.id);
    expect(useUndoStore.getState().records.length).toBe(0);
  });

  it("撤销后 activeToast 清除", async () => {
    const tabs = [mkTab("https://a.com")];
    const record = await useUndoStore.getState().addRecord(tabs, "test");
    await useUndoStore.getState().undoRecord(record.id);
    expect(useUndoStore.getState().activeToast).toBeNull();
  });

  it("撤销会话快照时恢复归档会话", async () => {
    const sessions = [mkSession("s1"), mkSession("s2")];
    const record = await useUndoStore
      .getState()
      .addSessionSnapshotRecord(sessions, "clear sessions");
    await useUndoStore.getState().undoRecord(record.id);
    expect(saveSessions).toHaveBeenCalledWith(sessions);
    expect(useUndoStore.getState().records.length).toBe(0);
  });

  it("撤销已过期记录不执行任何操作", async () => {
    const { nanoid } = await import("nanoid");
    (nanoid as ReturnType<typeof vi.fn>).mockReturnValueOnce("expired1");
    const tabs = [mkTab("https://a.com")];
    const record = await useUndoStore.getState().addRecord(tabs, "test");
    // 手动标记为过期
    useUndoStore.setState({
      records: [{ ...record, expired: true }],
    });
    await useUndoStore.getState().undoRecord(record.id);
    // 记录仍然存在
    expect(useUndoStore.getState().records.length).toBe(1);
  });
});

describe("dismissToast", () => {
  it("关闭 toast 但保留记录", async () => {
    const tabs = [mkTab("https://a.com")];
    await useUndoStore.getState().addRecord(tabs, "test");
    useUndoStore.getState().dismissToast();
    expect(useUndoStore.getState().activeToast).toBeNull();
    expect(useUndoStore.getState().records.length).toBe(1);
  });
});

describe("loadRecords", () => {
  it("从 storage 加载有效记录", async () => {
    const records: UndoRecord[] = [
      {
        id: "r1",
        createdAt: Date.now(),
        tabs: [mkTab("https://a.com")],
        description: "test",
        expired: false,
      },
    ];
    (getData as ReturnType<typeof vi.fn>).mockResolvedValueOnce(records);
    await useUndoStore.getState().loadRecords();
    expect(useUndoStore.getState().records.length).toBe(1);
  });

  it("过滤掉过期记录", async () => {
    const records: UndoRecord[] = [
      {
        id: "r1",
        createdAt: Date.now(),
        tabs: [mkTab("https://a.com")],
        description: "test",
        expired: true,
      },
    ];
    (getData as ReturnType<typeof vi.fn>).mockResolvedValueOnce(records);
    await useUndoStore.getState().loadRecords();
    expect(useUndoStore.getState().records.length).toBe(0);
  });
});

describe("cleanExpired", () => {
  it("清空过期记录", async () => {
    // 插入一条已过期记录（createdAt 在 10 秒前，超过 TTL）
    const oldRecord: UndoRecord = {
      id: "old1",
      createdAt: Date.now() - 10000,
      tabs: [mkTab("https://old.com")],
      description: "old",
      expired: false,
    };
    const freshRecord: UndoRecord = {
      id: "fresh1",
      createdAt: Date.now(),
      tabs: [mkTab("https://fresh.com")],
      description: "fresh",
      expired: false,
    };
    useUndoStore.setState({ records: [oldRecord, freshRecord] });
    await useUndoStore.getState().cleanExpired();
    expect(useUndoStore.getState().records.length).toBe(1);
    expect(useUndoStore.getState().records[0].id).toBe("fresh1");
  });
});
