/**
 * Hook: useSwBroadcast
 *
 * Listens to BroadcastChannel messages from the Service Worker
 * and dispatches them to the Zustand store.
 */

import { useEffect, useRef } from "react";
import { useTabsStore } from "@/store";
import type { SwBroadcastMessage, SwBroadcastType } from "@/shared/types";
import { APP_CHANNELS } from "@/shared/config/storage-keys";
import { BRAND } from "@/shared/config/brand";

const CHANNEL_NAME = APP_CHANNELS.swBroadcast;
const HIGH_FREQ_DEBOUNCE_MS = 200;

export function useSwBroadcast() {
  const handleBroadcast = useTabsStore((s) => s.handleBroadcast);
  const loadAllTabs = useTabsStore((s) => s.loadAllTabs);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;

    const handler = (event: MessageEvent<SwBroadcastMessage>) => {
      handleBroadcast(event.data);
    };

    const runtimeHandler = (message: SwBroadcastMessage) => {
      // 来源验证：只处理本扩展发出的消息，忽略其他扩展通过 chrome.runtime.sendMessage 广播的消息
      if (
        message &&
        typeof message.type === "string" &&
        typeof message.timestamp === "number" &&
        message.source === BRAND.id
      ) {
        handleBroadcast(message);
      }
    };

    const emit = (type: SwBroadcastType, payload: Record<string, unknown> = {}) => {
      handleBroadcast({ type, payload, timestamp: Date.now() });
    };

    /** Debounced refresh — 所有 chrome 事件统一 defer，避免 focus/window-switch 全量刷新风暴 */
    const refreshDebounced = (() => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      return () => {
        if (timer !== null) window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          timer = null;
          void loadAllTabs({ silent: true });
        }, HIGH_FREQ_DEBOUNCE_MS);
      };
    })();

    // 所有非关键刷新统一走 debounce，避免 focus 切换等引发全量重载风暴
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshDebounced();
    };

    // tab-removed: emit 即时更新本地 UI，数据刷新走 debounce
    const tabRemovedHandler: Parameters<typeof chrome.tabs.onRemoved.addListener>[0] = (tabId, removeInfo) => {
      emit("tab-removed", { id: tabId, windowId: removeInfo.windowId, isWindowClosing: removeInfo.isWindowClosing });
      refreshDebounced();
    };

    const tabActivatedHandler: Parameters<typeof chrome.tabs.onActivated.addListener>[0] = (activeInfo) => {
      emit("tab-activated", { id: activeInfo.tabId, windowId: activeInfo.windowId });
      refreshDebounced();
    };

    const windowFocusChangedHandler = (windowId: number) => {
      emit("window-focus-changed", { windowId });
      refreshDebounced();
    };

    channel.addEventListener("message", handler);
    chrome.runtime?.onMessage?.addListener?.(runtimeHandler);
    chrome.tabs?.onCreated?.addListener?.(refreshDebounced);
    chrome.tabs?.onUpdated?.addListener?.(refreshDebounced);
    chrome.tabs?.onRemoved?.addListener?.(tabRemovedHandler);
    chrome.tabs?.onActivated?.addListener?.(tabActivatedHandler);
    chrome.tabs?.onMoved?.addListener?.(refreshDebounced);
    chrome.tabs?.onAttached?.addListener?.(refreshDebounced);
    chrome.tabs?.onDetached?.addListener?.(refreshDebounced);
    chrome.tabs?.onReplaced?.addListener?.(refreshDebounced);
    chrome.windows?.onCreated?.addListener?.(refreshDebounced);
    chrome.windows?.onRemoved?.addListener?.(refreshDebounced);
    chrome.windows?.onFocusChanged?.addListener?.(windowFocusChangedHandler);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", refreshDebounced);
    window.addEventListener("pageshow", refreshDebounced);

    return () => {
      channel.removeEventListener("message", handler);
      channel.close();
      chrome.runtime?.onMessage?.removeListener?.(runtimeHandler);
      chrome.tabs?.onCreated?.removeListener?.(refreshDebounced);
      chrome.tabs?.onUpdated?.removeListener?.(refreshDebounced);
      chrome.tabs?.onRemoved?.removeListener?.(tabRemovedHandler);
      chrome.tabs?.onActivated?.removeListener?.(tabActivatedHandler);
      chrome.tabs?.onMoved?.removeListener?.(refreshDebounced);
      chrome.tabs?.onAttached?.removeListener?.(refreshDebounced);
      chrome.tabs?.onDetached?.removeListener?.(refreshDebounced);
      chrome.tabs?.onReplaced?.removeListener?.(refreshDebounced);
      chrome.windows?.onCreated?.removeListener?.(refreshDebounced);
      chrome.windows?.onRemoved?.removeListener?.(refreshDebounced);
      chrome.windows?.onFocusChanged?.removeListener?.(windowFocusChangedHandler);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", refreshDebounced);
      window.removeEventListener("pageshow", refreshDebounced);
    };
  }, [handleBroadcast, loadAllTabs]);
}
