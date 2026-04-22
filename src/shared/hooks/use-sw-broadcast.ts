/**
 * Hook: useSwBroadcast
 *
 * Listens to BroadcastChannel messages from the Service Worker
 * and dispatches them to the Zustand store.
 */

import { useEffect, useRef } from 'react';
import { useTabsStore } from '@/store';
import type { SwBroadcastMessage } from '@/shared/types';

const CHANNEL_NAME = 'canopy-sw-broadcast';

export function useSwBroadcast() {
  const handleBroadcast = useTabsStore((s) => s.handleBroadcast);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;

    const handler = (event: MessageEvent<SwBroadcastMessage>) => {
      handleBroadcast(event.data);
    };

    channel.addEventListener('message', handler);

    return () => {
      channel.removeEventListener('message', handler);
      channel.close();
    };
  }, [handleBroadcast]);
}
