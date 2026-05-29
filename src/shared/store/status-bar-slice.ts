/**
 * StatusBar Slice —— 底部持久消息层状态管理
 *
 * 与 ToastQueue（瞬时反馈）+ Modal（阻塞确认）三态语义配合：
 *   - StatusBar：持久消息，直到被主动清除或替换
 *   - ToastQueue：3-5 秒自动消失
 *   - Modal：阻塞确认
 */

import { create } from "zustand";

export interface StatusBarMessage {
  /** 唯一 ID */
  id: string;
  /** 消息文案 */
  content: string;
  /** 消息类型 */
  type: "info" | "success" | "warning" | "error";
  /** 关联的操作（可选） */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** 自动消失时间（ms），0 = 不自动消失 */
  duration?: number;
}

interface StatusBarState {
  /** 当前消息队列（同时只显示 1 条，多余的排队） */
  messages: StatusBarMessage[];
  /** 推入消息 */
  pushMessage: (msg: Omit<StatusBarMessage, "id">) => string;
  /** 移除消息 */
  removeMessage: (id: string) => void;
  /** 清空所有消息 */
  clearMessages: () => void;
}

let messageIdCounter = 0;

export const useStatusBarStore = create<StatusBarState>((set, get) => ({
  messages: [],

  pushMessage: (msg) => {
    const id = `status-${++messageIdCounter}`;
    const fullMsg: StatusBarMessage = { ...msg, id };

    set((state) => ({
      messages: [...state.messages, fullMsg],
    }));

    // 自动消失
    if (msg.duration && msg.duration > 0) {
      setTimeout(() => {
        get().removeMessage(id);
      }, msg.duration);
    }

    return id;
  },

  removeMessage: (id) => {
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== id),
    }));
  },

  clearMessages: () => {
    set({ messages: [] });
  },
}));
