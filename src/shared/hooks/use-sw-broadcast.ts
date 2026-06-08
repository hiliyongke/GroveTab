/**
 * Hook: useSwBroadcast
 *
 * Listens to BroadcastChannel messages from the Service Worker
 * and dispatches them to the Zustand store.
 *
 * SW 已通过 BroadcastChannel 推送所有 tab/window 事件，
 * NTP 不必重复注册 chrome.tabs.* / chrome.windows.* 监听器。
 * 仅保留 channel / runtimeMessage / visibility / focus / pageshow 触发器。
 */

import { useEffect, useRef } from "react";
import { useTabsStore } from "@/store";
import type { SwBroadcastMessage } from "@/shared/types";
import { APP_CHANNELS } from "@/shared/config/storage-keys";
import { BRAND } from "@/shared/config/brand";

const CHANNEL_NAME = APP_CHANNELS.swBroadcast;
const HIGH_FREQ_DEBOUNCE_MS = 200;

export function useSwBroadcast() {
  const handleBroadcast = useTabsStore((s) => s.handleBroadcast);
  const loadAllTabs = useTabsStore((s) => s.loadAllTabs);

  /** 用 ref 解耦 useEffect 依赖，避免 store 引用变化时重建监听器 */
  const handleBroadcastRef = useRef(handleBroadcast);
  const loadAllTabsRef = useRef(loadAllTabs);
  handleBroadcastRef.current = handleBroadcast;
  loadAllTabsRef.current = loadAllTabs;

  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL_NAME);

    const handler = (event: MessageEvent<SwBroadcastMessage>) => {
      handleBroadcastRef.current(event.data);
    };

    const runtimeHandler = (message: SwBroadcastMessage) => {
      if (
        message &&
        typeof message.type === "string" &&
        typeof message.timestamp === "number" &&
        message.source === BRAND.id
      ) {
        handleBroadcastRef.current(message);
      }
    };

    /** Debounced refresh — 用于页面级触发器（visibility/focus/pageshow） */
    const refreshDebounced = (() => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      return () => {
        if (timer !== null) window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          timer = null;
          void loadAllTabsRef.current({ silent: true });
        }, HIGH_FREQ_DEBOUNCE_MS);
      };
    })();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshDebounced();
    };

    // 仅保留页面级触发器；tab/window 事件由 SW BroadcastChannel 统一推送
    channel.addEventListener("message", handler);
    chrome.runtime?.onMessage?.addListener?.(runtimeHandler);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", refreshDebounced);
    window.addEventListener("pageshow", refreshDebounced);

    return () => {
      channel.removeEventListener("message", handler);
      channel.close();
      chrome.runtime?.onMessage?.removeListener?.(runtimeHandler);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", refreshDebounced);
      window.removeEventListener("pageshow", refreshDebounced);
    };
  }, []); // 依赖为空 — ref 始终指向最新 store 函数
}
