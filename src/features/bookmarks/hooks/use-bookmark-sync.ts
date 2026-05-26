/**
 * useBookmarkSync
 *
 * 监听 SW 广播的书签变更事件（bookmark-created / bookmark-changed /
 * bookmark-removed / bookmark-moved），触发 onRefresh 回调，
 * 实现书签中心 UI 与浏览器书签的实时同步（需求 5.1）。
 */

import { useEffect, useRef } from "react";
import { APP_CHANNELS } from "@/shared/config/storage-keys";
import type { SwBroadcastMessage } from "@/shared/types";

const BOOKMARK_EVENTS = new Set<SwBroadcastMessage["type"]>([
  "bookmark-created",
  "bookmark-changed",
  "bookmark-removed",
  "bookmark-moved",
]);

/**
 * @param onRefresh 书签变更时调用的刷新函数（应为稳定引用，建议用 useCallback 包裹）
 * @param enabled   是否启用监听（未授权时传 false 避免无效监听）
 */
export function useBookmarkSync(onRefresh: () => void, enabled = true): void {
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  });

  useEffect(() => {
    if (!enabled) return;

    const channel = new BroadcastChannel(APP_CHANNELS.swBroadcast);

    const handler = (event: MessageEvent<SwBroadcastMessage>) => {
      if (BOOKMARK_EVENTS.has(event.data.type)) {
        onRefreshRef.current();
      }
    };

    channel.addEventListener("message", handler);
    return () => {
      channel.removeEventListener("message", handler);
      channel.close();
    };
  }, [enabled]);
}
