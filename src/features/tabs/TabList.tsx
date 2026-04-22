/**
 * TabList — Renders all tabs as a simple flat list
 */

import { useTabsStore } from '@/store';
import { TabItem } from './TabItem';

export function TabList() {
  const tabs = useTabsStore((s) => s.tabs);
  const jumpToTab = useTabsStore((s) => s.jumpToTab);
  const closeSingleTab = useTabsStore((s) => s.closeSingleTab);

  if (tabs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-white/50">
        <p className="text-lg">没有打开的标签页</p>
        <p className="text-sm mt-2">打开一些网页，然后回到这里查看</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm text-white/40 mb-2 px-1">
        {tabs.length} 个标签页
      </div>
      {tabs.map((tab) => (
        <TabItem
          key={tab.id}
          tab={tab}
          onJump={jumpToTab}
          onClose={closeSingleTab}
        />
      ))}
    </div>
  );
}
