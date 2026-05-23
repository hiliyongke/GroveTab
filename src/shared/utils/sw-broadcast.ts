/**
 * SW Broadcast 跨窗口通信工具
 *
 * Service Worker 和 new tab 页面通过 BroadcastChannel 通信。
 * 此工具在两端都可以使用——SW 用它发广播，new tab 页面用它发信号给 SW。
 */

import type { SwBroadcastMessage, SwBroadcastType } from '@/shared/types';
import { BRAND } from '@/shared/config/brand';
import { APP_CHANNELS } from '@/shared/config/storage-keys';

const CHANNEL_NAME = APP_CHANNELS.swBroadcast;

let _channel: BroadcastChannel | null = null;

/**
 * 获取或创建 BroadcastChannel 单例
 *
 * 懒初始化，避免模块加载时就创建连接。
 *
 * @returns BroadcastChannel 实例
 */
function getChannel(): BroadcastChannel {
  _channel ??= new BroadcastChannel(CHANNEL_NAME);
  return _channel;
}

/**
 * 向所有扩展窗口广播消息。
 * SW 和 new tab 页面都可以调用。
 *
 * @param type    消息类型
 * @param payload 消息负载
 * @returns 无返回值
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
    // BroadcastChannel 在某些上下文（如非扩展页面）可能报错，静默忽略
    console.warn(`${BRAND.logTag} swBroadcast failed:`, err);
  }
}
