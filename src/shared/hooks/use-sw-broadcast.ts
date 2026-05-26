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

    const refreshSilently = () => {
      void loadAllTabs({ silent: true });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshSilently();
      }
    };

    const tabRemovedHandler: Parameters<typeof chrome.tabs.onRemoved.addListener>[0] = (
      tabId,
      removeInfo,
    ) => {
      emit("tab-removed", {
        id: tabId,
        windowId: removeInfo.windowId,
        isWindowClosing: removeInfo.isWindowClosing,
      });
      refreshSilently();
    };

    const tabActivatedHandler: Parameters<typeof chrome.tabs.onActivated.addListener>[0] = (
      activeInfo,
    ) => {
      emit("tab-activated", { id: activeInfo.tabId, windowId: activeInfo.windowId });
      refreshSilently();
    };

    const windowFocusChangedHandler = (windowId: number) => {
      emit("window-focus-changed", { windowId });
      refreshSilently();
    };

    channel.addEventListener("message", handler);
    chrome.runtime?.onMessage?.addListener?.(runtimeHandler);
    chrome.tabs?.onCreated?.addListener?.(refreshSilently);
    chrome.tabs?.onUpdated?.addListener?.(refreshSilently);
    chrome.tabs?.onRemoved?.addListener?.(tabRemovedHandler);
    chrome.tabs?.onActivated?.addListener?.(tabActivatedHandler);
    chrome.tabs?.onMoved?.addListener?.(refreshSilently);
    chrome.tabs?.onAttached?.addListener?.(refreshSilently);
    chrome.tabs?.onDetached?.addListener?.(refreshSilently);
    chrome.tabs?.onReplaced?.addListener?.(refreshSilently);
    chrome.windows?.onCreated?.addListener?.(refreshSilently);
    chrome.windows?.onRemoved?.addListener?.(refreshSilently);
    chrome.windows?.onFocusChanged?.addListener?.(windowFocusChangedHandler);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", refreshSilently);
    window.addEventListener("pageshow", refreshSilently);

    return () => {
      channel.removeEventListener("message", handler);
      channel.close();
      chrome.runtime?.onMessage?.removeListener?.(runtimeHandler);
      chrome.tabs?.onCreated?.removeListener?.(refreshSilently);
      chrome.tabs?.onUpdated?.removeListener?.(refreshSilently);
      chrome.tabs?.onRemoved?.removeListener?.(tabRemovedHandler);
      chrome.tabs?.onActivated?.removeListener?.(tabActivatedHandler);
      chrome.tabs?.onMoved?.removeListener?.(refreshSilently);
      chrome.tabs?.onAttached?.removeListener?.(refreshSilently);
      chrome.tabs?.onDetached?.removeListener?.(refreshSilently);
      chrome.tabs?.onReplaced?.removeListener?.(refreshSilently);
      chrome.windows?.onCreated?.removeListener?.(refreshSilently);
      chrome.windows?.onRemoved?.removeListener?.(refreshSilently);
      chrome.windows?.onFocusChanged?.removeListener?.(windowFocusChangedHandler);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", refreshSilently);
      window.removeEventListener("pageshow", refreshSilently);
    };
  }, [handleBroadcast, loadAllTabs]);
}
