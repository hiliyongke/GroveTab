/**
 * useSwBroadcast — Service Worker 广播通信 Hook
 *
 * 监听来自 Service Worker 的 BroadcastChannel 消息，
 * 并根据消息类型分发到对应的 Zustand store 处理函数。
 *
 * 支持的消息类型：
 *   - 'stats-updated'：触发统计数据的重新加载
 *   - 其他类型：交给 handleBroadcast 统一处理
 */

import { useEffect, useRef } from 'react';
import { useTabsStore, useStatsStore } from '@/store';
import type { SwBroadcastMessage } from '@/shared/types';
import { APP_CHANNELS } from '@/shared/config/storage-keys';

const CHANNEL_NAME = APP_CHANNELS.swBroadcast;

/**
 * 订阅 Service Worker 广播消息
 *
 * 在组件挂载时创建 BroadcastChannel 并监听消息，
 * 组件卸载时自动清理监听器和关闭通道。
 */
export function useSwBroadcast() {
  const handleBroadcast = useTabsStore((s) => s.handleBroadcast);
  const loadStats = useStatsStore((s) => s.loadStats);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;

    const handler = (event: MessageEvent<SwBroadcastMessage>) => {
      if (event.data.type === 'stats-updated') {
        void loadStats();
        return;
      }
      handleBroadcast(event.data);
    };

    channel.addEventListener('message', handler);

    return () => {
      channel.removeEventListener('message', handler);
      channel.close();
    };
  }, [handleBroadcast, loadStats]);
}
