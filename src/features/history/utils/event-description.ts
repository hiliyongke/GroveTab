/**
 * event-description —— 为历史事件生成人类可读的描述文本
 *
 * 不同事件类型对应不同模板，通过 i18n 翻译函数生成描述。
 */

import type { HistoryEvent } from '@/shared/types';

/**
 * 一条事件的描述文本（不同 type 不同模板）
 * @param e - 历史事件
 * @param t - i18n 翻译函数
 * @returns {string} 返回事件的描述文本
 */
export function eventDescription(
  e: HistoryEvent,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  switch (e.type) {
    case 'tab_opened': return t('history.eventTabOpened');
    case 'tab_closed': return t('history.eventTabClosed');
    case 'window_closed':
      return t('history.eventWindowClosed', { count: typeof e.extra?.tabCount === 'number' ? e.extra.tabCount : 0 });
    case 'tab_pinned': return t('history.eventTabPinned');
    case 'tab_tagged': return t('history.eventTabTagged');
    case 'archive_create': return t('history.eventArchiveCreate');
    case 'archive_restore': return t('history.eventArchiveRestore');
    case 'snapshot_create': return t('history.eventSnapshotCreate');
    case 'search_query':
      return t('history.eventSearchQuery', { query: typeof e.extra?.query === 'string' ? e.extra.query : '' });
    case 'search_engine_open':
      return t('history.eventSearchEngineOpen', {
        query: typeof e.extra?.query === 'string' ? e.extra.query : '',
        engine: typeof e.extra?.engine === 'string' ? e.extra.engine : '',
      });
    case 'workspace_switch': return t('history.eventWorkspaceSwitch');
    default: return '';
  }
}
