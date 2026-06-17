/**
 * Zustand Store — Sessions Slice
 *
 * 归档会话的 CRUD 状态管理，持久化由 ArchiveService 处理。
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
import { useUndoStore } from "./undo-slice";

interface SessionsState {
  sessions: ArchivedSession[];
  initialized: boolean;
  loading: boolean;
  error: string | null;

  loadSessions: () => Promise<void>;
  refreshSessions: () => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  renameSession: (id: string, newName: string) => Promise<void>;
  mergeSessions: (ids: string[], newName: string) => Promise<ArchivedSession | null>;
  exportSession: (id: string) => Promise<void>;
}

export const useSessionsStore = create<SessionsState>((set, get) => ({
  sessions: [],
  initialized: false,
  loading: false,
  error: null,

  loadSessions: async () => {
    const { initialized, loading } = get();
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
      const previous = await getArchivedSessions();
      const target = previous.find((s) => s.id === id);
      await svcDeleteSession(id);
      set((state) => ({
        sessions: state.sessions.filter((s) => s.id !== id),
      }));
      if (target !== undefined) {
        await useUndoStore
          .getState()
          .addSessionSnapshotRecord(previous, `${translate("已删除会话")}「${target.name}」`, {
            subNote: translate("可在撤销窗口内恢复"),
          });
      }
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
      const previous = await getArchivedSessions();
      const newSession = await svcMergeSessions(ids, newName);
      const sessions = await getArchivedSessions();
      set({ sessions });
      await useUndoStore
        .getState()
        .addSessionSnapshotRecord(previous, `${translate("已合并会话")}「${newSession.name}」`, {
          subNote: translate("可在撤销窗口内恢复合并前状态"),
        });
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

/** 注册归档撤销处理器：撤销"创建归档"时删除对应会话。 */
export function registerSessionsUndoHandler(): void {
  void import("@/services/history/undo-bus").then(({ registerHistoryUndoHandler }) => {
    registerHistoryUndoHandler("archive_create", async (event) => {
      const sessionId = (event.undoContext as { sessionId?: string } | undefined)?.sessionId;
      if (sessionId === undefined || sessionId === "") return false;
      await svcDeleteSession(sessionId);
      await useSessionsStore.getState().refreshSessions();
      return true;
    });
  });
}

let undoHandlerRegistered = false;
if (!undoHandlerRegistered) {
  undoHandlerRegistered = true;
  registerSessionsUndoHandler();
}
