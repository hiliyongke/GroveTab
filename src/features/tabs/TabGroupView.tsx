/**
 * TabGroupView — Chrome 原生 Tab Group 视图
 *
 * 一级按 Chrome 原生分组，二级按域名展示标签页。
 * 未分组的标签归入"未分组"区域。
 *
 * 设计：
 *   - 使用 antd Card + Collapse 展示分组
 *   - 每个分组卡片显示组名（或颜色标记）、标签数量
 *   - 支持将域名分组同步到 Chrome Tab Group
 */

import { useMemo } from 'react';
import { Tag, Collapse, Empty } from 'antd';
import { useTabsStore } from '@/store';
import { TabItem } from './TabItem';
import { useT } from '@/shared/i18n';
import styles from './styles/views.module.less';

/**
 * Chrome Tab Group 颜色映射到 antd Tag color
 */
const GROUP_COLOR_MAP: Record<string, string> = {
  grey: 'default',
  blue: 'blue',
  red: 'red',
  yellow: 'gold',
  green: 'green',
  pink: 'magenta',
  purple: 'purple',
  cyan: 'cyan',
  orange: 'orange',
};

interface TabGroupData {
  /** 分组 ID（-1 表示未分组） */
  groupId: number;
  /** 分组标题 */
  title: string;
  /** 分组颜色 */
  color: string;
  /** 该组下的标签页 */
  tabs: typeof useTabsStore extends { getState: () => { tabs: infer T } } ? T : never;
}

/**
 * Chrome Tab Group 视图
 */
export function TabGroupView() {
  const tabs = useTabsStore((s) => s.tabs);
  const jumpToTab = useTabsStore((s) => s.jumpToTab);
  const closeSingleTab = useTabsStore((s) => s.closeSingleTab);
  const { t } = useT();

  /**
   * 按 Chrome 原生 Tab Group 分组
   *   - groupId === -1 或 undefined → 归入"未分组"
   *   - 其他 → 按 groupId 分组，从 tab.groupTitle / tab.groupColor 取信息
   */
  const groups = useMemo(() => {
    const map = new Map<number, TabGroupData>();

    for (const tab of tabs) {
      const gid = tab.groupId ?? -1;
      if (!map.has(gid)) {
        map.set(gid, {
          groupId: gid,
          title: gid === -1
            ? t('未分组')
            : (tab.groupTitle || t('未命名分组')),
          color: gid === -1 ? 'grey' : (tab.groupColor || 'grey'),
          tabs: [],
        });
      }
      map.get(gid)!.tabs.push(tab);
    }

    // 未分组排最后
    const result = Array.from(map.values());
    const ungrouped = result.find((g) => g.groupId === -1);
    const grouped = result.filter((g) => g.groupId !== -1);
    return [...grouped, ...(ungrouped ? [ungrouped] : [])];
  }, [tabs, t]);

  if (tabs.length === 0) {
    return (
      <Empty
        description={t('没有打开的标签页')}
        className={styles['app-tab-group-empty']}
      />
    );
  }

  /** 为每个分组内的标签构造可见 ID 列表（用于多选） */
  const allTabIds = tabs.map((t) => t.id);

  return (
    <Collapse
      defaultActiveKey={groups.map((g) => String(g.groupId))}
      ghost
      items={groups.map((group) => ({
        key: String(group.groupId),
        label: (
          <div className={styles['app-tab-group-label']}>
            <Tag
              color={GROUP_COLOR_MAP[group.color] || 'default'}
              className={styles['app-tab-group-tag']}
            >
              {group.title}
            </Tag>
            <span className={styles['app-tab-group-count']}>
              {group.tabs.length}
            </span>
          </div>
        ),
        children: (
          <div className={styles['app-tab-group-list']}>
            {group.tabs.map((tab) => (
              <TabItem
                key={tab.id}
                tab={tab}
                onJump={(id, wid) => { void jumpToTab(id, wid); }}
                onClose={(id) => { void closeSingleTab(id); }}
                showHostname
                selectable
                visibleTabIds={allTabIds}
              />
            ))}
          </div>
        ),
      }))}
    />
  );
}
