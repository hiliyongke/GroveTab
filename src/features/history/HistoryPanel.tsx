/**
 * HistoryPanel —— 插件原生历史记录面板
 *
 * 设计目标：
 *   1. 以「最近关闭」为头号场景：用户最常的诉求是"误关 tab 撤回"
 *   2. 提供完整的操作时间线（搜索/打开/关闭/归档/快照…），按"今天/昨天/本周/更早"分组
 *   3. 全部本地数据，关闭即清；不调用任何远端
 *
 * 交互要点：
 *   - 单条点击 → 重新打开
 *   - 整窗一键恢复（来自 ClosedWindowRecord）
 *   - 类型筛选 + 关键词搜索
 *   - 危险操作（清空全部）走 Popconfirm 二次确认
 */

import {
  useState,
  useMemo,
  useCallback,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  Drawer,
  Tabs,
  Input,
  Empty,
  Button,
  Tooltip,
  Tag,
  Popconfirm,
  Segmented,
  theme,
} from 'antd';
import {
  History,
  RotateCcw,
  Trash2,
  Search,
  X,
  Layers,
  Clock,
  Globe,
  Pin,
  Tag as TagIcon,
  Archive as ArchiveIcon,
  Camera,
  ArrowRightLeft,
  TrendingUp,
  TrendingDown,
  Undo2,
} from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { useT } from '@/shared/i18n';
import { createTab } from '@/chrome';
import type {
  ClosedTabRecord,
  ClosedWindowRecord,
  HistoryEvent,
  HistoryEventType,
  SnapshotDiff,
} from '@/shared/types';
import { useHistoryData } from './hooks/use-history-data';
import { useHistoryActions } from './hooks/use-history-actions';
import { bucketize, TIME_GROUPS } from './utils/time-bucket';
import { eventDescription } from './utils/event-description';
import styles from './HistoryPanel.module.less';

interface HistoryPanelProps {
  open: boolean;
  onClose: () => void;
}

type FilterMode = 'all' | 'tabs' | 'search' | 'archive';

/** 相对时间描述：刚刚 / N 分钟前 / N 小时前 / N 天前
 * @returns {(ts: number) => string} 返回格式化相对时间字符串的函数
 */
function useRelativeTime() {
  const { t } = useT();
  return useCallback((ts: number): string => {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1) return t('history.justNow');
    if (m < 60) return t('history.minutesAgo', { n: m });
    const h = Math.floor(m / 60);
    if (h < 24) return t('history.hoursAgo', { n: h });
    const d = Math.floor(h / 24);
    return t('history.daysAgo', { n: d });
  }, [t]);
}

/**
 * 历史事件类型图标映射
 * @param type - 历史事件类型
 * @returns {ReactNode} 返回对应的图标组件
 */
function eventIcon(type: HistoryEventType): ReactNode {
  const size = ICON_SIZE.SMALL;
  switch (type) {
    case 'tab_opened': return <Layers size={size} />;
    case 'tab_closed': return <X size={size} />;
    case 'window_closed': return <X size={size} />;
    case 'tab_pinned': return <Pin size={size} />;
    case 'tab_tagged': return <TagIcon size={size} />;
    case 'archive_create':
    case 'archive_restore': return <ArchiveIcon size={size} />;
    case 'snapshot_create': return <Camera size={size} />;
    case 'search_query':
    case 'search_engine_open': return <Search size={size} />;
    case 'workspace_switch': return <ArrowRightLeft size={size} />;
    default: return <Clock size={size} />;
  }
}

/**
 * 把事件类型分类成 filter 桶
 * @param type - 历史事件类型
 * @returns {FilterMode} 返回事件对应的过滤模式
 */
function eventBucket(type: HistoryEventType): FilterMode {
  if (type === 'search_query' || type === 'search_engine_open') return 'search';
  if (type === 'archive_create' || type === 'archive_restore' || type === 'snapshot_create') return 'archive';
  return 'tabs';
}

/**
 * 「昨天 → 今天」对比卡片
 *
 * 视觉策略：
 *   - 顶部一行总数：今天 N（昨天 M，±delta）
 *   - 两列芯片：左列「新开始访问」、右列「不再活跃」，最多各显示 5 个
 *   - 没有变化时显示一个友好的「同昨天一致」提示
 * @param root0 - 组件属性
 * @param root0.diff - 快照对比数据
 * @param root0.t - i18n 翻译函数
 * @returns {ReactNode} 返回快照对比卡片 JSX 元素
 */
function SnapshotDiffCard({
  diff,
  t,
}: {
  diff: SnapshotDiff;
  t: (key: string, params?: Record<string, string | number>) => string;
}): ReactNode {
  const sign = diff.delta > 0 ? '+' : diff.delta < 0 ? '' : '±';
  const isFlat = diff.added.length === 0 && diff.removed.length === 0;
  const MAX_CHIPS = 5;
  const addedShown = diff.added.slice(0, MAX_CHIPS);
  const removedShown = diff.removed.slice(0, MAX_CHIPS);
  const addedExtra = diff.added.length - addedShown.length;
  const removedExtra = diff.removed.length - removedShown.length;
  return (
    <div className={styles['history-diff-card']}>
      <div className={styles['history-diff-card-head']}>
        <div className={styles['history-diff-card-title']}>
          <Camera size={ICON_SIZE.SMALL} />
          <span>{t('history.diffTitle')}</span>
        </div>
        <span className={styles['history-diff-card-subtitle']}>{t('history.diffSubtitle')}</span>
      </div>
      <div className={styles['history-diff-card-total']}>
        {t('history.diffTotalDelta', {
          today: diff.today.totalTabs,
          yesterday: diff.yesterday.totalTabs,
          sign,
          delta: Math.abs(diff.delta),
        })}
      </div>
      {isFlat ? (
        <div className={styles['history-diff-empty']}>{t('history.diffEmpty')}</div>
      ) : (
        <div className={styles['history-diff-cols']}>
          {addedShown.length > 0 && (
            <div className={styles['history-diff-col']}>
              <div className={`${styles['history-diff-col-title']} ${styles['history-diff-col-title--added']}`}>
                <TrendingUp size={ICON_SIZE.TINY} />
                <span>{t('history.diffAdded')}</span>
              </div>
              <ul className={styles['history-diff-chips']}>
                {addedShown.map((item) => (
                  <li key={`a-${item.host}`} className={`${styles['history-diff-chip']} ${styles['history-diff-chip--added']}`}>
                    <span className={styles['history-diff-chip-host']}>{item.host}</span>
                    <span className={styles['history-diff-chip-count']}>×{item.count}</span>
                  </li>
                ))}
                {addedExtra > 0 && (
                  <li className={`${styles['history-diff-chip']} ${styles['history-diff-chip--more']}`}>
                    {t('history.diffMore', { n: addedExtra })}
                  </li>
                )}
              </ul>
            </div>
          )}
          {removedShown.length > 0 && (
            <div className={styles['history-diff-col']}>
              <div className={`${styles['history-diff-col-title']} ${styles['history-diff-col-title--removed']}`}>
                <TrendingDown size={ICON_SIZE.TINY} />
                <span>{t('history.diffRemoved')}</span>
              </div>
              <ul className={styles['history-diff-chips']}>
                {removedShown.map((item) => (
                  <li key={`r-${item.host}`} className={`${styles['history-diff-chip']} ${styles['history-diff-chip--removed']}`}>
                    <span className={styles['history-diff-chip-host']}>{item.host}</span>
                    <span className={styles['history-diff-chip-count']}>×{item.count}</span>
                  </li>
                ))}
                {removedExtra > 0 && (
                  <li className={`${styles['history-diff-chip']} ${styles['history-diff-chip--more']}`}>
                    {t('history.diffMore', { n: removedExtra })}
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 历史记录面板主组件
 *
 * @param root0 - 组件属性
 * @param root0.open - 是否打开面板
 * @param root0.onClose - 关闭面板回调
 * @returns {JSX.Element} 返回历史面板 JSX 元素
 */
export function HistoryPanel({ open, onClose }: HistoryPanelProps) {
  const { t } = useT();
  const { token } = theme.useToken();
  const relTime = useRelativeTime();

  const [activeTab, setActiveTab] = useState<'closed' | 'timeline'>('closed');
  const [keyword, setKeyword] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  // ── 数据加载 ──────────────────────────────────
  const {
    closedTabs,
    closedWindows,
    events,
    snapshotDiff,
    loading,
    refresh,
  } = useHistoryData(open);

  // ── 操作处理 ─────────────────────────────────
  const {
    handleRestoreOne,
    handleDeleteClosed,
    handleRestoreWindow,
    handleDeleteEvent,
    handleUndoEvent,
    handleClearAll,
  } = useHistoryActions({ refresh, closedTabs });

  /** 关键词过滤的最近关闭 */
  const filteredClosedTabs = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (k === '') return closedTabs;
    return closedTabs.filter((c) =>
      c.title.toLowerCase().includes(k)
      || c.url.toLowerCase().includes(k)
      || c.hostname.toLowerCase().includes(k),
    );
  }, [closedTabs, keyword]);

  /** 时间桶分组（最近关闭） */
  const groupedClosed = useMemo(() => {
    const map = new Map<string, ClosedTabRecord[]>();
    for (const item of filteredClosedTabs) {
      const b = bucketize(item.ts);
      const list = map.get(b) ?? [];
      list.push(item);
      map.set(b, list);
    }
    return map;
  }, [filteredClosedTabs]);

  /** 关键词 + filter 过滤的事件 */
  const filteredEvents = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    return events.filter((e) => {
      if (filterMode !== 'all' && eventBucket(e.type) !== filterMode) return false;
      if (k === '') return true;
      const hay = [
        e.title ?? '',
        e.url ?? '',
        e.hostname ?? '',
        typeof e.extra?.query === 'string' ? e.extra.query : '',
      ].join(' ').toLowerCase();
      return hay.includes(k);
    });
  }, [events, filterMode, keyword]);

  /** 时间桶分组（事件） */
  const groupedEvents = useMemo(() => {
    const map = new Map<string, HistoryEvent[]>();
    for (const item of filteredEvents) {
      const b = bucketize(item.ts);
      const list = map.get(b) ?? [];
      list.push(item);
      map.set(b, list);
    }
    return map;
  }, [filteredEvents]);

  // ── 渲染 ────────────────────────────────────

  const headerExtra = (
    <div className={styles['history-panel-header-extra']}>
      <Popconfirm
        title={t('history.clearAllConfirm')}
        onConfirm={() => { void handleClearAll(); }}
        okButtonProps={{ danger: true }}
      >
        <Button size="small" type="text" danger icon={<Trash2 size={ICON_SIZE.SMALL} />}>
          {t('history.clearAll')}
        </Button>
      </Popconfirm>
    </div>
  );

  const drawerVars = {
    '--history-accent': token.colorPrimary,
    '--history-text': token.colorText,
    '--history-text-secondary': token.colorTextSecondary,
    '--history-text-tertiary': token.colorTextTertiary,
    '--history-fill-secondary': token.colorFillSecondary,
    '--history-fill-tertiary': token.colorFillTertiary,
    '--history-border': token.colorBorderSecondary,
    '--history-radius': `${token.borderRadiusLG}px`,
  } as CSSProperties;

  const renderClosedItem = (rec: ClosedTabRecord) => (
    <li key={rec.id} className={styles['history-item']}>
      {rec.favIconUrl !== '' ? (
        <img src={rec.favIconUrl} alt="" className={styles['history-item-favicon']}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      ) : (
        <span className={styles['history-item-favicon-fallback']}><Globe size={ICON_SIZE.SMALL} /></span>
      )}
      <div className={styles['history-item-main']} onClick={() => { void handleRestoreOne(rec); }}>
        <div className={styles['history-item-title']}>{rec.title || rec.url}</div>
        <div className={styles['history-item-subtitle']}>
          <span>{rec.hostname || rec.url}</span>
          <span className={styles['history-item-dot']}>·</span>
          <span>{relTime(rec.ts)}</span>
          {rec.pinned && <Tag color="gold" className={styles['history-item-tag']}>📌</Tag>}
        </div>
      </div>
      <div className={styles['history-item-actions']}>
        <Tooltip title={t('history.restore')}>
          <Button
            type="text"
            size="small"
            icon={<RotateCcw size={ICON_SIZE.SMALL} />}
            onClick={() => { void handleRestoreOne(rec); }}
          />
        </Tooltip>
        <Tooltip title={t('history.delete')}>
          <Button
            type="text"
            size="small"
            icon={<X size={ICON_SIZE.SMALL} />}
            onClick={() => { void handleDeleteClosed(rec); }}
          />
        </Tooltip>
      </div>
    </li>
  );

  /**
   * 整窗快照卡片（显示在最近关闭列表顶部）
   * @param win - 整窗关闭记录
   * @returns {JSX.Element} 返回整窗快照卡片 JSX 元素
   */
  const renderClosedWindow = (win: ClosedWindowRecord) => (
    <li key={`win-${win.id}`} className={styles['history-window-card']}>
      <div className={styles['history-window-card-head']}>
        <Layers size={ICON_SIZE.SMALL} />
        <span>{t('history.restoreWindow', { count: win.tabCount })}</span>
        <span className={styles['history-item-dot']}>·</span>
        <span className={styles['history-window-card-time']}>{relTime(win.ts)}</span>
      </div>
      <Button
        size="small"
        type="primary"
        icon={<RotateCcw size={ICON_SIZE.SMALL} />}
        onClick={() => { void handleRestoreWindow(win); }}
      >
        {t('history.restore')}
      </Button>
    </li>
  );

  const renderEvent = (e: HistoryEvent) => {
    const isUndone = e.extra?.undone === true;
    return (
      <li key={e.id} className={`${styles['history-event']}${isUndone ? ` ${styles['is-undone']}` : ''}`}>
        <span className={styles['history-event-icon']}>{eventIcon(e.type)}</span>
        <div
          className={styles['history-event-main']}
          onClick={() => {
            if (e.url !== undefined && e.url !== '') {
              void createTab({ url: e.url, active: true });
            }
          }}
        >
          <div className={styles['history-event-line']}>
            <span className={styles['history-event-action']}>{eventDescription(e, t)}</span>
            {e.title !== undefined && e.title !== '' && (
              <span className={styles['history-event-target']} title={e.url}>{e.title}</span>
            )}
            {isUndone && (
              <Tag color="default" className={styles['history-item-tag']}>{t('history.undone')}</Tag>
            )}
          </div>
          <div className={styles['history-event-meta']}>
            {e.hostname !== undefined && e.hostname !== '' && (
              <>
                <span>{e.hostname}</span>
                <span className={styles['history-item-dot']}>·</span>
              </>
            )}
            <span>{relTime(e.ts)}</span>
          </div>
        </div>
        {e.undoable === true && !isUndone && (
          <Tooltip title={t('history.undo')}>
            <Button
              type="text"
              size="small"
              icon={<Undo2 size={ICON_SIZE.SMALL} />}
              onClick={() => { void handleUndoEvent(e); }}
            />
          </Tooltip>
        )}
        <Tooltip title={t('history.delete')}>
          <Button
            type="text"
            size="small"
            icon={<X size={ICON_SIZE.SMALL} />}
            onClick={() => { void handleDeleteEvent(e.id); }}
          />
        </Tooltip>
      </li>
    );
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={520}
      title={(
        <div className={styles['history-panel-title']}>
          <History size={ICON_SIZE.MEDIUM} />
          <div>
            <div>{t('history.title')}</div>
            <div className={styles['history-panel-subtitle']}>{t('history.subtitle')}</div>
          </div>
        </div>
      )}
      extra={headerExtra}
      classNames={{
        mask: styles['history-drawer__mask'],
        header: styles['history-drawer__header'],
        title: styles['history-drawer__title'],
        body: styles['history-panel-body'],
        section: styles['history-drawer__section'],
      }}
      rootClassName={styles['history-panel-root']}
    >
      <div className={styles['history-panel-shell']} style={drawerVars}>
        <div className={styles['history-panel-toolbar']}>
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={t('history.searchPlaceholder')}
            prefix={<Search size={ICON_SIZE.SMALL} />}
            allowClear
            size="middle"
          />
          <Tabs
            activeKey={activeTab}
            onChange={(k) => setActiveTab(k as 'closed' | 'timeline')}
            size="small"
            items={[
              { key: 'closed', label: t('history.tabRecentlyClosed') },
              { key: 'timeline', label: t('history.tabTimeline') },
            ]}
          />
          {activeTab === 'timeline' && (
            <Segmented<FilterMode>
              size="small"
              value={filterMode}
              onChange={(v) => setFilterMode(v)}
              options={[
                { value: 'all', label: t('history.filterAll') },
                { value: 'tabs', label: t('history.filterTabs') },
                { value: 'search', label: t('history.filterSearch') },
                { value: 'archive', label: t('history.filterArchive') },
              ]}
              block
            />
          )}
        </div>

        <div className={styles['history-panel-list']}>
          {snapshotDiff !== null && (
            <SnapshotDiffCard diff={snapshotDiff} t={t} />
          )}
          {activeTab === 'closed' ? (
            filteredClosedTabs.length === 0 && closedWindows.length === 0 ? (
              <Empty
                description={t('history.emptyClosed')}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <>
                {closedWindows.length > 0 && (
                  <ul className={styles['history-window-list']}>
                    {closedWindows.map(renderClosedWindow)}
                  </ul>
                )}
                {TIME_GROUPS.map(({ id, labelKey }) => {
                  const list = groupedClosed.get(id);
                  if (!list || list.length === 0) return null;
                  return (
                    <section key={id} className={styles['history-group']}>
                      <div className={styles['history-group-title']}>{t(labelKey)}</div>
                      <ul className={styles['history-list']}>{list.map(renderClosedItem)}</ul>
                    </section>
                  );
                })}
              </>
            )
          ) : (
            filteredEvents.length === 0 ? (
              <Empty
                description={loading ? '...' : t('history.empty')}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <div className={styles['history-empty-hint']}>{t('history.emptyHint')}</div>
              </Empty>
            ) : (
              TIME_GROUPS.map(({ id, labelKey }) => {
                const list = groupedEvents.get(id);
                if (!list || list.length === 0) return null;
                return (
                  <section key={id} className={styles['history-group']}>
                    <div className={styles['history-group-title']}>{t(labelKey)}</div>
                    <ul className={styles['history-list']}>{list.map(renderEvent)}</ul>
                  </section>
                );
              })
            )
          )}
        </div>
      </div>
    </Drawer>
  );
}

export default HistoryPanel;
