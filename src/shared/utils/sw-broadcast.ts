/**
 * SW Broadcast 跨窗口通信工具
 *
 * Service Worker 和 newtab 页面通过 BroadcastChannel 通信。
 * 此工具在两端都可以使用——SW 用它发广播，newtab 页面用它发信号给 SW。
 */

import type { SwBroadcastMessage, SwBroadcastType } from '@/shared/types';

const CHANNEL_NAME = 'canopy-sw-broadcast';

let _channel: BroadcastChannel | null = null;

/** 获取或创建 BroadcastChannel（避免重复创建） */
function getChannel(): BroadcastChannel {
  if (!_channel) {
    _channel = new BroadcastChannel(CHANNEL_NAME);
  }
  return _channel;
}

/**
 * 向所有 Canopy 窗口广播消息。
 * SW 和 newtab 页面都可以调用。
 */
export function swBroadcast(type: SwBroadcastType, payload: Record<string, unknown> = {}): void {
  try {
    const message: SwBroadcastMessage = {
      type,
      payload,
      timestamp: Date.now(),
    };
    getChannel().postMessage(message);
  } catch (err) {
    // BroadcastChannel 在某些上下文（如非 extension 页面）可能报错，静默忽略
    console.warn('[Canopy] swBroadcast failed:', err);
  }
}
