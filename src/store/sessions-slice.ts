 
/**
 * Zustand Store — Sessions Slice（归档会话状态管理）
 *
 * 职责：
 *   1. 管理归档会话列表的 Zustand 状态（作为 Source of Truth）
 *   2. 提供 sessions 相关的 CRUD actions（调用 ArchiveService 执行持久化）
 *   3. 自动订阅 ArchiveService 数据变化并同步到 store
 *
 * 设计决策：
 *   - 存储路由（OPFS/IDB/chrome.storage）仍由 ArchiveService 管理，sessions-slice 不重复逻辑
 *   - ArchiveView 通过 useSessionsStore 订阅，而非使用 useSyncExternalStore + 模块级 cache
 *   - 保持 ArchiveService 的独立性，便于其他地方（如 SW）直接使用
 *
 * 依赖：
 *   - archive-storage: getArchivedSessions（通过 subscribe 间接触发）
 *   - archive-session-management: deleteSession, renameSession, mergeSessions, exportSingleSession
 */

import { create } from "zustand";
import type { ArchivedSession } from "@/shared/types";
import {
  getArchivedSessions,
  deleteSession as svcDeleteSession,
  renameSession as svcRenameSession,
  mergeSessions as svcMergeSessions,
  exportSingleSession as svcExportSingleSession,
} from "@/services/archive";
import { BRAND } from "@/shared/config/brand";
import { feedback } from "@/shared/ui/feedback";
import { translate } from "@/shared/i18n/core";

interface SessionsState {
  /** 归档会话列表（Source of Truth） */
  sessions: ArchivedSession[];
  /** 是否已初始化（从存储加载过一次） */
  initialized: boolean;
  /** 是否正在加载 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;

  // Actions
  /** 从存储加载全部会话（幂等，多次调用不会重复刷新） */
  loadSessions: () => Promise<void>;
  /** 刷新会话列表（强制从存储重新读取） */
  refreshSessions: () => Promise<void>;
  /** 删除指定会话 */
  deleteSession: (id: string) => Promise<void>;
  /** 重命名指定会话 */
  renameSession: (id: string, newName: string) => Promise<void>;
  /** 合并指定会话（ids 数组，合并后生成新会话） */
  mergeSessions: (ids: string[], newName: string) => Promise<ArchivedSession | null>;
  /** 导出单个会话为 JSON 文件 */
  exportSession: (id: string) => Promise<void>;
}

export const useSessionsStore = create<SessionsState>((set, get) => ({
  sessions: [],
  initialized: false,
  loading: false,
  error: null,

  loadSessions: async () => {
    const { initialized, loading } = get();
    // 已有数据或正在加载中，跳过（避免重复触发）
    if (initialized || loading) return;

    set({ loading: true, error: null });
    try {
      const sessions = await getArchivedSessions();
      set({ sessions, initialized: true, loading: false });
    } catch (err) {
      console.warn(`${BRAND.logTag} loadSessions failed`, err);
      set({ error: String(err), loading: false });
    }
  },

  refreshSessions: async () => {
    set({ loading: true, error: null });
    try {
      const sessions = await getArchivedSessions();
      set({ sessions, initialized: true, loading: false });
    } catch (err) {
      console.warn(`${BRAND.logTag} refreshSessions failed`, err);
      set({ error: String(err), loading: false });
    }
  },

  deleteSession: async (id: string) => {
    try {
      await svcDeleteSession(id);
      set((state) => ({
        sessions: state.sessions.filter((s) => s.id !== id),
      }));
    } catch (err) {
      feedback.error(translate("删除失败，请重试"), err);
      throw err;
    }
  },

  renameSession: async (id: string, newName: string) => {
    try {
      await svcRenameSession(id, newName);
      set((state) => ({
        sessions: state.sessions.map((s) => (s.id === id ? { ...s, name: newName } : s)),
      }));
    } catch (err) {
      feedback.error(translate("重命名失败，请重试"), err);
      throw err;
    }
  },

  mergeSessions: async (ids: string[], newName: string) => {
    try {
      const newSession = await svcMergeSessions(ids, newName);
      // 重新加载以获取准确的会话列表（merge 会删除原会话）
      const sessions = await getArchivedSessions();
      set({ sessions });
      return newSession;
    } catch (err) {
      feedback.error(translate("合并失败，请重试"), err);
      throw err;
    }
  },

  exportSession: async (id: string) => {
    const payload = await svcExportSingleSession(id);
    if (payload === null) {
      feedback.error(translate("分享失败，请重试"));
      return;
    }
    try {
      const blob = new Blob([payload.content], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = payload.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      feedback.success(translate("已下载会话 JSON"));
    } catch (err) {
      feedback.error(translate("分享失败，请重试"), err);
    }
  },
}));

/**
 * 归档会话撤销处理器（注册到 undo-bus）
 *
 * 当用户撤销"创建归档"操作时，删除对应会话。
 * 注意：这是在 Zustand store 之外的补救机制——
 * 主要的状态同步仍通过 sessions-slice 的 refreshSessions 完成。
 */
export function registerSessionsUndoHandler(): void {
  // 动态导入避免循环依赖
  void import("@/services/history/undo-bus").then(({ registerHistoryUndoHandler }) => {
    registerHistoryUndoHandler("archive_create", async (event) => {
      const sessionId = (event.undoContext as { sessionId?: string } | undefined)?.sessionId;
      if (sessionId === undefined || sessionId === "") return false;
      await svcDeleteSession(sessionId);
      // 触发 sessions-slice 同步（通过 refreshSessions）
      // 使用 useSessionsStore.getState() 直接获取当前 state 的 refreshSessions
      await useSessionsStore.getState().refreshSessions();
      return true;
    });
  });
}

// 在模块加载时自动注册撤销处理器（确保只注册一次）
let undoHandlerRegistered = false;
if (!undoHandlerRegistered) {
  undoHandlerRegistered = true;
  registerSessionsUndoHandler();
}