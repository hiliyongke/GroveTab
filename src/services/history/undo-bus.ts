/**
 * History Undo Bus
 *
 * ─────────────────────────────────────────────────────────────────
 * 「时间线撤销」的极简事件总线。
 *
 * 设计目标：
 *   - 让 HistoryView 能在不直接耦合 archive / tag / metadata 任何业务模块
 *     的前提下，统一支持「撤销」按钮。
 *   - 各业务模块在初始化时通过 `registerHistoryUndoHandler(type, fn)` 注册
 *     自己的撤销实现；HistoryView 调用 `undoHistoryEvent(event)` 时分发到
 *     注册的 handler，handler 负责真正的副作用。
 *   - 不持久化注册关系（每次启动都需要业务模块自行注册一次）。
 *
 * 设计权衡：
 *   - 这是 in-memory 的，不跨上下文（newtab 与 sw 各自有一份），
 *     这意味着 sw 自动 push 的 undoable 事件需要在 newtab 一侧补回 handler。
 *   - 用 `Map<HistoryEventType, Handler>` 替代多 handler 数组：
 *     一种 type 同时只能有一个生效的撤销实现，足够使用，避免歧义。
 *
 * 用法：
 *   ```ts
 *   // 业务侧（模块初始化处）
 *   registerHistoryUndoHandler('archive_create', async (event) => {
 *     const sessionId = event.undoContext?.sessionId as string | undefined;
 *     if (sessionId !== undefined) await deleteSession(sessionId);
 *   });
 *
 *   // UI 侧
 *   const ok = await undoHistoryEvent(event);
 *   if (ok) await markHistoryEventUndone(event.id);
 *   ```
 */

import type { HistoryEvent, HistoryEventType } from '@/shared/types';

/** 撤销 handler：成功返回 true，失败/未实现返回 false 或抛错 */
export type HistoryUndoHandler = (event: HistoryEvent) => Promise<boolean | void>;

/** 全局 handler 注册表（按事件 type） */
const handlers = new Map<HistoryEventType, HistoryUndoHandler>();

/**
 * 注册一个事件 type 的撤销实现。
 * 同一 type 第二次调用会覆盖前次注册（便于热更新场景），
 * 返回值为 unregister 函数。
 */
export function registerHistoryUndoHandler(
  type: HistoryEventType,
  handler: HistoryUndoHandler,
): () => void {
  handlers.set(type, handler);
  return () => {
    if (handlers.get(type) === handler) {
      handlers.delete(type);
    }
  };
}

/** 当前 type 是否已有撤销实现注册 */
export function hasHistoryUndoHandler(type: HistoryEventType): boolean {
  return handlers.has(type);
}

/**
 * 触发某条事件的撤销。
 *
 * @returns true：撤销成功；false：未注册 handler 或 handler 返回 false。
 *   抛错时由调用方自行 toast。
 */
export async function undoHistoryEvent(event: HistoryEvent): Promise<boolean> {
  const handler = handlers.get(event.type);
  if (handler === undefined) return false;
  const result = await handler(event);
  // handler 显式返回 false 视为失败；其他（true / void）视为成功
  return result !== false;
}
