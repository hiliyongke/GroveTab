/**
 * TimelineView —— 按访问时间段展示（antd Timeline 版）
 *
 * 设计：
 *   - 外层使用 antd `Timeline`，每个非空时段作为一个节点
 *   - 排序遵循「最新优先」：段级、段内 tab 均按 `lastAccessed` 倒序，
 *     让刚访问过的内容始终在顶部，无需滚动
 *   - 节点 dot 颜色随段向下变浅（最新最亮，越旧越暗），呼应"新鲜度"
 *   - 节点标题行：段名 + 计数徽章 + 折叠箭头，整行可点击折叠
 *   - 展开时将 TabItem 列表垂直排列，保留 hostname 副标题（跨域名上下文）
 *   - 支持两档分组粒度（配置项 `timelineGranularity`）：
 *       * day  —— 今天/昨天/本周/更早（默认，简洁）
 *       * hour —— 今天 + 昨天都按「整点小时」桶细分并倒序，本周/更早按天
 *
 *   历史遗留：配置里曾有第三档 `fine`，与 `hour` 行为高度重叠（二者都靠
 *   7 个时段桶聚合，只在「昨天是否拆分」上有差异，绝大多数用户看不出区别）。
 *   2026-04-22 起合并为两档，并把 `hour` 重写成真正的「按小时」整点分桶；
 *   `fine` 归一化为 `hour` 保持向后兼容。
 */

import { useMemo, useState } from 'react';
import { Timeline, theme } from 'antd';
import { ChevronDown } from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { useTabsStore, useSettingsStore } from '@/store';
import { useT } from '@/shared/i18n';
import { findAmbiguousTitleIds } from '@/shared/utils/url-display';
import { TabItem } from './TabItem';
import type { LiveTab } from '@/shared/types';

/** 翻译函数类型（与 useT 返回的 t 对齐） */
type TFn = (key: string, vars?: Record<string, string | number>) => string;

/** 单个时间段的内部结构 */
interface TimeSegment {
  key: string;
  label: string;
  tabs: LiveTab[];
}

/**
 * 将毫秒时间戳格式化为 HH:mm（两位补零）
 */
function formatHM(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * 取一组 tab 在该段内的访问时间跨度
 *   - 单条：返回 "HH:mm"
 *   - 多条且首尾相同分钟：返回 "HH:mm"
 *   - 多条：返回 "HH:mm – HH:mm"
 */
function formatSegmentRange(tabs: LiveTab[]): string {
  if (tabs.length === 0) return '';
  let min = Infinity;
  let max = -Infinity;
  for (const t of tabs) {
    const ts = t.lastAccessed || 0;
    if (!ts) continue;
    if (ts < min) min = ts;
    if (ts > max) max = ts;
  }
  if (!isFinite(min)) return '';
  const start = formatHM(min);
  const end = formatHM(max);
  return start === end ? start : `${start} – ${end}`;
}

/**
 * 将一组 tabs 按「整点小时桶」聚合，返回非空桶数组
 *
 * 每个桶代表一个 1 小时区间（如 `14:00 – 15:00`），桶标签展示为
 * `14:00–15:00`，保留 `dayPrefix`（"今天 "/"昨天 "）以便跨天区分。
 *
 * 排序策略（与原 bucketByHourBand 一致）：
 *   - 桶级按小时倒序（最新的小时在前）
 *   - 桶内 tab 按 `lastAccessed` 倒序
 *
 * 设计动机：
 *   原先基于 7 个时段（早/上午/中午/下午/傍晚/晚上/深夜）的分桶虽然语义
 *   友好，但精度过粗：任意 3-5 小时的活动都被压成同一段，用户感知不到
 *   小时级的节奏。整点分桶能让"11 点集中看文档、14 点集中开会"这样的
 *   行为模式一眼可辨。
 *
 * @param tabs       待分组的标签
 * @param dayPrefix  桶名前缀（跨天时传 "昨天 "）
 * @param keyPrefix  段 key 前缀，避免今天/昨天冲突
 */
function bucketByHour(
  tabs: LiveTab[],
  dayPrefix: string,
  keyPrefix: string,
): TimeSegment[] {
  /** hour(0-23) → 桶数据 */
  const map = new Map<number, TimeSegment>();

  for (const tab of tabs) {
    const ts = tab.lastAccessed || 0;
    if (!ts) continue;
    const hour = new Date(ts).getHours();
    if (!map.has(hour)) {
      const hh = hour.toString().padStart(2, '0');
      const nextHh = ((hour + 1) % 24).toString().padStart(2, '0');
      const bucketLabel = `${hh}:00–${nextHh}:00`;
      map.set(hour, {
        key: `${keyPrefix}-h${hour}`,
        label: dayPrefix ? `${dayPrefix}${bucketLabel}` : bucketLabel,
        tabs: [],
      });
    }
    map.get(hour)!.tabs.push(tab);
  }

  // 桶内按访问时间倒序
  for (const seg of map.values()) {
    seg.tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
  }

  // 桶级按小时倒序（23 → 0）
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, seg]) => seg);
}

/**
 * 今天的"刚刚"段特殊处理：< 30 分钟的访问单独成段，置于最前
 *
 * 段内 tabs 按访问时间倒序，最新的在最上面。
 */
function extractJustNow(tabs: LiveTab[], t: TFn): [TimeSegment | null, LiveTab[]] {
  const threshold = Date.now() - 30 * 60 * 1000;
  const recent: LiveTab[] = [];
  const rest: LiveTab[] = [];
  for (const tab of tabs) {
    if ((tab.lastAccessed || 0) >= threshold) recent.push(tab);
    else rest.push(tab);
  }
  if (recent.length === 0) return [null, rest];
  recent.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
  return [
    {
      key: 'today-justNow',
      label: t('timeline.justNow'),
      tabs: recent,
    },
    rest,
  ];
}

/**
 * 根据分组粒度生成时间段
 *
 * 排序策略：**最新优先**（无论段级还是段内 tab 级）。
 * - day ：今天 → 昨天 → 本周 → 更早；段内按 `lastAccessed` 倒序
 * - hour：刚刚 → 今天按小时倒序 → 昨天按小时倒序 → 本周 → 更早
 *
 * @param tabs        全量标签
 * @param granularity 粒度档位（day/hour）
 * @param t           i18n 翻译函数
 */
function getTimeSegments(
  tabs: LiveTab[],
  granularity: 'day' | 'hour',
  t: TFn,
): TimeSegment[] {
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const yesterdayStart = todayStart - 86400000;
  const weekStart = todayStart - 6 * 86400000;

  // 先按天粗分
  const todayTabs: LiveTab[] = [];
  const yesterdayTabs: LiveTab[] = [];
  const weekTabs: LiveTab[] = [];
  const olderTabs: LiveTab[] = [];

  for (const tab of tabs) {
    const accessed = tab.lastAccessed || 0;
    if (accessed >= todayStart) todayTabs.push(tab);
    else if (accessed >= yesterdayStart) yesterdayTabs.push(tab);
    else if (accessed >= weekStart) weekTabs.push(tab);
    else olderTabs.push(tab);
  }

  /** 段内按访问时间倒序的工具函数 */
  const byAccessDesc = (a: LiveTab, b: LiveTab) =>
    (b.lastAccessed || 0) - (a.lastAccessed || 0);

  const segments: TimeSegment[] = [];

  // —— 今天 ——
  if (granularity === 'day') {
    if (todayTabs.length > 0) {
      segments.push({
        key: 'today',
        label: t('timeline.today'),
        tabs: [...todayTabs].sort(byAccessDesc),
      });
    }
  } else {
    // hour：今天按整点小时桶倒序，且抽出「刚刚」置顶
    const [justNow, restToday] = extractJustNow(todayTabs, t);
    if (justNow) segments.push(justNow);
    segments.push(...bucketByHour(restToday, '', 'today'));
  }

  // —— 昨天 ——
  if (granularity === 'hour') {
    // hour 档下：昨天也按整点小时桶倒序，前缀带「昨天 」
    segments.push(
      ...bucketByHour(yesterdayTabs, `${t('timeline.yesterdayPrefix')} `, 'yesterday'),
    );
  } else if (yesterdayTabs.length > 0) {
    segments.push({
      key: 'yesterday',
      label: t('timeline.yesterday'),
      tabs: [...yesterdayTabs].sort(byAccessDesc),
    });
  }

  // —— 本周 / 更早 ——（始终按天汇总，段内按访问时间倒序）
  if (weekTabs.length > 0) {
    segments.push({
      key: 'week',
      label: t('timeline.thisWeek'),
      tabs: [...weekTabs].sort(byAccessDesc),
    });
  }
  if (olderTabs.length > 0) {
    segments.push({
      key: 'older',
      label: t('timeline.older'),
      tabs: [...olderTabs].sort(byAccessDesc),
    });
  }

  return segments;
}

/**
 * 段标题（可折叠点击区）
 */
function SegmentHeader({
  label,
  rangeText,
  count,
  collapsed,
  onToggle,
}: {
  label: string;
  rangeText?: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { token } = theme.useToken();

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      className="app-timeline-segment-header"
      style={
        {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          height: 24,
          padding: '0 8px 0 0',
          fontSize: 13,
          fontWeight: 600,
          transition: `color ${token.motionDurationFast}`,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          outline: 'none',
          // 颜色通过 CSS 变量下发，:hover 规则里切换，避免内联 color 被覆盖
          ['--app-color' as string]: token.colorTextSecondary,
          ['--app-color-hover' as string]: token.colorText,
        } as React.CSSProperties
      }
    >
      <span>{label}</span>
      {rangeText && (
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 400,
            color: token.colorTextTertiary,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {rangeText}
        </span>
      )}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 20,
          height: 18,
          padding: '0 6px',
          borderRadius: 9,
          background: token.colorFillSecondary,
          color: token.colorTextTertiary,
          fontSize: 11,
          fontWeight: 500,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {count}
      </span>
      <ChevronDown
        size={ICON_SIZE.MICRO}
        style={{
          color: token.colorTextTertiary,
          transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
          transition: `transform ${token.motionDurationMid}`,
        }}
      />
    </button>
  );
}

/**
 * 时间段节点内容（标题 + 可折叠的 TabItem 列表）
 */
function SegmentContent({
  segment,
  showExactTime,
}: {
  segment: TimeSegment;
  showExactTime: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const jumpToTab = useTabsStore((s) => s.jumpToTab);
  const closeSingleTab = useTabsStore((s) => s.closeSingleTab);
  const { token } = theme.useToken();
  /** 段内同名 tab id 集合 */
  const ambiguousIds = useMemo(() => findAmbiguousTitleIds(segment.tabs), [segment.tabs]);
  /** 段内 tab ID 列表（供 Shift 范围选） */
  const segmentTabIds = useMemo(() => segment.tabs.map((t) => t.id), [segment.tabs]);

  /** 段尾/段首时间范围（供段标题展示） */
  const rangeText = showExactTime ? formatSegmentRange(segment.tabs) : undefined;

  return (
    <div style={{ paddingBottom: collapsed ? 4 : 12 }}>
      <div style={{ marginBottom: collapsed ? 0 : 6 }}>
        <SegmentHeader
          label={segment.label}
          rangeText={rangeText}
          count={segment.tabs.length}
          collapsed={collapsed}
          onToggle={() => setCollapsed((v) => !v)}
        />
      </div>

      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {segment.tabs.map((tab) => (
            <TabItem
              key={tab.id}
              tab={tab}
              onJump={(id, wid) => { void jumpToTab(id, wid); }}
              onClose={(id) => { void closeSingleTab(id); }}
              showHostname
              showUrlHint={ambiguousIds.has(tab.id)}
              selectable
              visibleTabIds={segmentTabIds}
              trailing={
                showExactTime && tab.lastAccessed ? (
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: 11.5,
                      color: token.colorTextTertiary,
                      fontVariantNumeric: 'tabular-nums',
                      minWidth: 38,
                      textAlign: 'right',
                    }}
                  >
                    {formatHM(tab.lastAccessed)}
                  </span>
                ) : null
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 时间轴视图（主组件）
 */
export function TimelineView() {
  const tabs = useTabsStore((s) => s.tabs);
  /**
   * 读取粒度设置。
   *
   * 历史配置里可能存有已废弃的 `'fine'`，此处统一向 `'hour'` 归一化，
   * 避免旧数据进入 `getTimeSegments` 的 day/hour 二选一分支时类型收窄失败。
   */
  const rawGranularity = useSettingsStore(
    (s) => s.settings.timelineGranularity ?? 'day',
  );
  const granularity: 'day' | 'hour' =
    rawGranularity === 'day' ? 'day' : 'hour';
  const showExactTime = useSettingsStore(
    (s) => s.settings.timelineShowExactTime ?? false,
  );
  const { t } = useT();
  const { token } = theme.useToken();

  const segments = useMemo(
    () => getTimeSegments(tabs, granularity, t),
    [tabs, granularity, t],
  );

  if (tabs.length === 0) return null;

  /**
   * dot 颜色分配：越靠前越亮（= 越新）
   *
   * 因为整体已改为最新优先排序，第 0 段就是最新的段；
   * 粒度细时段数变多，用 4 档渐变 + 向后 clamp，保证视觉平滑。
   */
  const dotColors = [
    token.colorPrimary,
    token.colorPrimaryBorder,
    token.colorBorder,
    token.colorBorderSecondary,
  ];

  const items = segments.map((segment, idx) => ({
    key: segment.key,
    color: dotColors[Math.min(idx, dotColors.length - 1)],
    children: <SegmentContent segment={segment} showExactTime={showExactTime} />,
  }));

  return (
    <div style={{ paddingTop: 4 }}>
      <Timeline items={items} />
    </div>
  );
}
