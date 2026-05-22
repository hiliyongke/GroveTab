/**
 * useSiteGroups — 常用站点分组逻辑
 *
 * 按 group 字段聚合站点，未分组的使用翻译后的"未分组"标签。
 * 当所有站点都未分组时，隐藏分组标题（返回空字符串作为 key）。
 */

import { useMemo } from 'react';
import type { SpeedDialSite } from '@/shared/types';

interface UseSiteGroupsProps {
  sites: readonly SpeedDialSite[];
  groupEnabled: boolean;
  ungroupedLabel: string;
}

interface GroupedItem {
  groupName: string;
  sites: SpeedDialSite[];
}

interface UseSiteGroupsReturn {
  grouped: GroupedItem[];
  existingGroups: string[];
}

export function useSiteGroups({
  sites,
  groupEnabled,
  ungroupedLabel,
}: UseSiteGroupsProps): UseSiteGroupsReturn {
  /** 从站点列表提取已有分组名（去重、排序） */
  const existingGroups = useMemo(() => {
    const set = new Set<string>();
    for (const s of sites) {
      if (s.group) set.add(s.group);
    }
    return [...set].sort();
  }, [sites]);

  /** 按 group 聚合站点 */
  const grouped = useMemo(() => {
    if (!groupEnabled) {
      return [{ groupName: '', sites: [...sites] }];
    }

    const map = new Map<string, SpeedDialSite[]>();
    for (const site of sites) {
      const key = site.group || ungroupedLabel;
      const arr = map.get(key);
      if (arr) arr.push(site);
      else map.set(key, [site]);
    }

    const result = [...map.entries()].map(([groupName, groupSites]) => ({
      groupName,
      sites: groupSites,
    }));

    /** 全部未分组时隐藏噪音标题 */
    if (result.length === 1 && result[0]?.groupName === ungroupedLabel) {
      return [{ groupName: '', sites: result[0]!.sites }];
    }

    return result;
  }, [sites, groupEnabled, ungroupedLabel]);

  return { grouped, existingGroups };
}
