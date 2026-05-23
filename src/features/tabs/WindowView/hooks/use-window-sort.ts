/**
 * useWindowSort — 窗口视图智能排序 Hook
 *
 * 提供对标签列表执行智能排序的功能
 * 支持按域名、最近访问、字母顺序、标签类型排序
 */

import { useCallback } from 'react';
import { feedback } from '@/shared/ui/feedback';
import { track as trackEvent } from '@/shared/utils/metrics';
import {
  reorderTabs,
  sortTabsByRule,
} from '@/features/tabs/services/window-tab-operations';
import type { LiveTab } from '@/shared/types/tab';
import type { SmartSortRule } from '../types';

/**
 * 获取排序规则对应的 i18n 名称
 *
 * 将排序规则枚举转换为用户可读的本地化名称。
 *
 * @param rule - 智能排序规则
 * @param t - 国际化翻译函数
 * @returns 排序规则的本地化名称
 */
function getSortRuleName(rule: SmartSortRule, t: (key: string) => string): string {
  switch (rule) {
    case 'domain':
      return t('window.smartSortByDomain');
    case 'recentAccess':
      return t('window.smartSortByRecentAccess');
    case 'alphabetical':
      return t('window.smartSortByAlphabetical');
    case 'type':
      return t('window.smartSortByType');
  }
}

interface UseWindowSortOptions {
  t: (key: string, params?: Record<string, string | number>) => string;
  windowId: number;
  windowTabs: LiveTab[];
  onSuccess?: () => void;
}

interface UseWindowSortReturn {
  handleSmartSort: (rule: SmartSortRule) => Promise<void>;
}

/**
 * 窗口视图智能排序 Hook
 *
 * 提供对标签列表执行智能排序的功能。
 * 支持按域名、最近访问、字母顺序、标签类型排序。
 *
 * @param options - Hook 配置选项
 * @param options.t - 国际化翻译函数
 * @param options.windowId - 当前窗口 ID
 * @param options.windowTabs - 当前窗口的标签页列表
 * @param options.onSuccess - 排序成功后的回调（可选）
 * @returns 包含智能排序函数的对象
 */
export function useWindowSort({
  t,
  windowId,
  windowTabs,
  onSuccess,
}: UseWindowSortOptions): UseWindowSortReturn {
  const handleSmartSort = useCallback(
    async (rule: SmartSortRule) => {
      try {
        const sortedIds = sortTabsByRule(windowTabs, rule);
        if (sortedIds.length === 0) return;

        await reorderTabs(sortedIds);

        feedback.success(
          t('window.smartSortSuccess', {
            rule: getSortRuleName(rule, t),
            count: String(sortedIds.length),
          }),
        );
        void trackEvent('smart_sort', { rule, windowId, count: sortedIds.length });
        onSuccess?.();
      } catch (err) {
        feedback.error(t('window.moveFailed'));
        console.warn('[WindowView] smart sort failed', err);
      }
    },
    [windowTabs, windowId, t, onSuccess],
  );

  return { handleSmartSort };
}
