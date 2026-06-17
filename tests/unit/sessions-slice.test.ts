/**
 * Sessions Slice 单元测试
 *
 * 覆盖：
 * - loadSessions 的幂等：重复调用不重复加载
 * - refreshSessions 强制刷新
 * - deleteSession 乐观更新
 * - renameSession 乐观更新
 * - mergeSessions 重新拉取
 * - 错误路径：服务抛错时 store 状态正确
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const sessionsFixture = (id: string, name = id) =>
  ({
    id,
    name,
    createdAt: 0,
    tabs: [],
    source: "manual",
  }) as never;

vi.mock("@/services/archive", () => ({
  getArchivedSessions: vi.fn().mockResolvedValue([]),
  deleteSession: vi.fn().mockResolvedValue(undefined),
  renameSession: vi.fn().mockResolvedValue(undefined),
  mergeSessions: vi.fn(),
  exportSingleSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/shared/ui/feedback", () => ({
  feedback: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    notify: { error: vi.fn() },
    modal: { confirm: vi.fn() },
  },
}));

vi.mock("@/shared/i18n/core", () => ({
  translate: (s: string) => s,
}));

// undo-bus 在模块顶层动态注册，桩成 noop
vi.mock("@/services/history/undo-bus", () => ({
  registerHistoryUndoHandler: vi.fn(),
}));

vi.mock("@/store/undo-slice", () => ({
  useUndoStore: {
    getState: vi.fn(() => ({
      addSessionSnapshotRecord: vi.fn().mockResolvedValue({ id: "undo1" }),
    })),
  },
}));

import { useSessionsStore } from "@/store/sessions-slice";
import {
  getArchivedSessions,
  deleteSession as svcDeleteSession,
  renameSession as svcRenameSession,
  mergeSessions as svcMergeSessions,
} from "@/services/archive";
import { feedback } from "@/shared/ui/feedback";

beforeEach(() => {
  vi.clearAllMocks();
  useSessionsStore.setState({
    sessions: [],
    initialized: false,
    loading: false,
    error: null,
  });
});

describe("loadSessions", () => {
  it("首次加载从 service 拉数据并标记 initialized", async () => {
    (getArchivedSessions as ReturnType<typeof vi.fn>).mockResolvedValueOnce([sessionsFixture("a")]);
    await useSessionsStore.getState().loadSessions();
    const s = useSessionsStore.getState();
    expect(s.sessions.length).toBe(1);
    expect(s.initialized).toBe(true);
    expect(s.loading).toBe(false);
  });

  it("已 initialized 时再次调用不会重复拉取", async () => {
    useSessionsStore.setState({ initialized: true });
    await useSessionsStore.getState().loadSessions();
    expect(getArchivedSessions).not.toHaveBeenCalled();
  });

  it("loading 中再次调用不会重复拉取", async () => {
    useSessionsStore.setState({ loading: true });
    await useSessionsStore.getState().loadSessions();
    expect(getArchivedSessions).not.toHaveBeenCalled();
  });

  it("service 抛错时 error 字段被设置", async () => {
    (getArchivedSessions as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("io error"));
    await useSessionsStore.getState().loadSessions();
    expect(useSessionsStore.getState().error).toContain("io error");
    expect(useSessionsStore.getState().loading).toBe(false);
  });
});

describe("refreshSessions", () => {
  it("无视 initialized 强制重拉", async () => {
    useSessionsStore.setState({ initialized: true });
    (getArchivedSessions as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      sessionsFixture("x"),
      sessionsFixture("y"),
    ]);
    await useSessionsStore.getState().refreshSessions();
    expect(useSessionsStore.getState().sessions.length).toBe(2);
  });

  it("拉取失败时 error 字段被记录", async () => {
    (getArchivedSessions as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("x"));
    await useSessionsStore.getState().refreshSessions();
    expect(useSessionsStore.getState().error).toContain("x");
  });
});

describe("deleteSession", () => {
  it("成功后立即从内存列表移除", async () => {
    useSessionsStore.setState({
      sessions: [sessionsFixture("a"), sessionsFixture("b")],
      initialized: true,
    });
    await useSessionsStore.getState().deleteSession("a");
    expect(useSessionsStore.getState().sessions.map((s) => s.id)).toEqual(["b"]);
  });

  it("service 抛错时调用 feedback.error 并重新抛出", async () => {
    useSessionsStore.setState({ sessions: [sessionsFixture("a")], initialized: true });
    (svcDeleteSession as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("nope"));
    await expect(useSessionsStore.getState().deleteSession("a")).rejects.toThrow("nope");
    expect(feedback.error).toHaveBeenCalled();
  });
});

describe("renameSession", () => {
  it("成功后乐观更新名称", async () => {
    useSessionsStore.setState({ sessions: [sessionsFixture("a", "old")], initialized: true });
    await useSessionsStore.getState().renameSession("a", "new");
    expect(useSessionsStore.getState().sessions[0]?.name).toBe("new");
  });

  it("不命中的 id 保持原列表不变", async () => {
    useSessionsStore.setState({ sessions: [sessionsFixture("a", "old")], initialized: true });
    await useSessionsStore.getState().renameSession("nope", "new");
    expect(useSessionsStore.getState().sessions[0]?.name).toBe("old");
  });

  it("service 抛错时 feedback.error 被调用", async () => {
    useSessionsStore.setState({ sessions: [sessionsFixture("a", "old")], initialized: true });
    (svcRenameSession as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("x"));
    await expect(useSessionsStore.getState().renameSession("a", "new")).rejects.toThrow("x");
    expect(feedback.error).toHaveBeenCalled();
  });
});

describe("mergeSessions", () => {
  it("成功后从 service 重新拉取列表", async () => {
    const newSession = sessionsFixture("merged", "merged");
    (svcMergeSessions as ReturnType<typeof vi.fn>).mockResolvedValueOnce(newSession);
    (getArchivedSessions as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([newSession]);
    const result = await useSessionsStore.getState().mergeSessions(["a", "b"], "merged");
    expect(result).toBe(newSession);
    expect(useSessionsStore.getState().sessions).toEqual([newSession]);
  });

  it("service 抛错时 feedback.error + rethrow", async () => {
    (svcMergeSessions as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("merge fail"));
    await expect(useSessionsStore.getState().mergeSessions(["a"], "x")).rejects.toThrow(
      "merge fail",
    );
    expect(feedback.error).toHaveBeenCalled();
  });
});
