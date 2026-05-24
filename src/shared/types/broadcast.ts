/**
 * Broadcast Message Type Definitions
 * Service Worker 广播消息相关类型
 */

/** Broadcast message types from SW to new tab pages */
export type SwBroadcastType =
  | "tab-created"
  | "tab-updated"
  | "tab-removed"
  | "tab-activated"
  | "tab-moved"
  | "tab-attached"
  | "tab-detached"
  | "tab-discarded"
  | "tab-grouped"
  | "tab-ungrouped"
  | "tab-group-updated"
  | "window-focus-changed"
  | "window-created"
  | "window-removed"
  | "window-card-order-changed";

export interface SwBroadcastMessage {
  type: SwBroadcastType;
  payload: Record<string, unknown>;
  timestamp: number;
}
