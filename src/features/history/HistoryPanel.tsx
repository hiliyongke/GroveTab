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
  useEffect,
  useMemo,
  useCallback,
  type CSSProperties,
  type ReactNode,
} from "react";
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
  Image,
  Space,
} from "antd";
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
} from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useT } from "@/shared/i18n";
import { feedback } from "@/shared/ui/feedback";
import { createTab } from "@/chrome";
import {
  getClosedTabs,
  getClosedWindows,
  getHistoryEvents,
  deleteClosedTab,
  deleteClosedWindow,
  deleteHistoryEvent,
  clearAllNativeHistory,
  getDailySnapshots,
  diffSnapshots,
  snapshotDateKey,
  markHistoryEventUndone,
} from "@/repositories";
import { hasHistoryUndoHandler, undoHistoryEvent } from "@/services/history/undo-bus";
import type {
  ClosedTabRecord,
  ClosedWindowRecord,
  DailySnapshot,
  HistoryEvent,
  HistoryEventType,
  SnapshotDiff,
} from "@/shared/types";
import styles from "./HistoryPanel.module.less";

interface HistoryPanelProps {
  open: boolean;
  onClose: () => void;
}

type FilterMode = "all" | "tabs" | "search" | "archive";

/** "时间分组"对应的展示顺序与标签 key */
const TIME_GROUPS: Array<{ id: "today" | "yesterday" | "thisWeek" | "earlier"; labelKey: string }> =
  [
    { id: "today", labelKey: "history.groupToday" },
    { id: "yesterday", labelKey: "history.groupYesterday" },
    { id: "thisWeek", labelKey: "history.groupThisWeek" },
    { id: "earlier", labelKey: "history.groupEarlier" },
  ];

function bucketize(ts: number): (typeof TIME_GROUPS)[number]["id"] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 3600 * 1000;
  const thisWeekStart = todayStart - 6 * 24 * 3600 * 1000;
  if (ts >= todayStart) return "today";
  if (ts >= yesterdayStart) return "yesterday";
  if (ts >= thisWeekStart) return "thisWeek";
  return "earlier";
}

/** 相对时间描述：刚刚 / N 分钟前 / N 小时前 / N 天前 */
function useRelativeTime() {
  const { t } = useT();
  return useCallback(
    (ts: number): string => {
      const diff = Date.now() - ts;
      const m = Math.floor(diff / 60000);
      if (m < 1) return t('刚刚');
      if (m < 60) return t('{n} 分钟前', { n: m });
      const h = Math.floor(m / 60);
      if (h < 24) return t('{n} 小时前', { n: h });
      const d = Math.floor(h / 24);
      return t('{n} 天前', { n: d });
    },
    [t],
  );
}

/** 历史事件类型图标映射 */
function eventIcon(type: HistoryEventType): ReactNode {
  const size = ICON_SIZE.SMALL;
  switch (type) {
    case "tab_opened":
      return <Layers size={size} />;
    case "tab_closed":
      return <X size={size} />;
    case "window_closed":
      return <X size={size} />;
    case "tab_pinned":
      return <Pin size={size} />;
    case "tab_tagged":
      return <TagIcon size={size} />;
    case "archive_create":
    case "archive_restore":
      return <ArchiveIcon size={size} />;
    case "snapshot_create":
      return <Camera size={size} />;
    case "search_query":
    case "search_engine_open":
      return <Search size={size} />;
    case "workspace_switch":
      return <ArrowRightLeft size={size} />;
    default:
      return <Clock size={size} />;
  }
}

/** 把事件类型分类成 filter 桶 */
function eventBucket(type: HistoryEventType): FilterMode {
  if (type === "search_query" || type === "search_engine_open") return "search";
  if (type === "archive_create" || type === "archive_restore" || type === "snapshot_create")
    return "archive";
  return "tabs";
}

/**
 * 「昨天 → 今天」对比卡片
 *
 * 视觉策略：
 *   - 顶部一行总数：今天 N（昨天 M，±delta）
 *   - 两列芯片：左列「新开始访问」、右列「不再活跃」，最多各显示 5 个
 *   - 没有变化时显示一个友好的「同昨天一致」提示
 */
function SnapshotDiffCard({
  diff,
  t,
}: {
  diff: SnapshotDiff;
  t: (key: string, params?: Record<string, string | number>) => string;
}): ReactNode {
  const sign = diff.delta > 0 ? "+" : diff.delta < 0 ? "" : "±";
  const isFlat = diff.added.length === 0 && diff.removed.length === 0;
  const MAX_CHIPS = 5;
  const addedShown = diff.added.slice(0, MAX_CHIPS);
  const removedShown = diff.removed.slice(0, MAX_CHIPS);
  const addedExtra = diff.added.length - addedShown.length;
  const removedExtra = diff.removed.length - removedShown.length;
  return (
    <div className={styles["history-diff-card"]}>
      <div className={styles["history-diff-card-head"]}>
        <div className={styles["history-diff-card-title"]}>
          <Camera size={ICON_SIZE.SMALL} />
          <span>{t('昨天 → 今天')}</span>
        </div>
        <span className={styles["history-diff-card-subtitle"]}>{t('按站点汇总的使用变化')}</span>
      </div>
      <div className={styles["history-diff-card-total"]}>
        {t('总标签 {today}（昨天 {yesterday}，{sign}{delta}）', {
          today: diff.today.totalTabs,
          yesterday: diff.yesterday.totalTabs,
          sign,
          delta: Math.abs(diff.delta),
        })}
      </div>
      {isFlat ? (
        <div className={styles["history-diff-empty"]}>{t('两天访问的站点完全一致 ✨')}</div>
      ) : (
        <div className={styles["history-diff-cols"]}>
          {addedShown.length > 0 && (
            <div className={styles["history-diff-col"]}>
              <div
                className={`${styles["history-diff-col-title"]} ${styles["history-diff-col-title--added"]}`}
              >
                <TrendingUp size={ICON_SIZE.TINY} />
                <span>{t('新开始访问')}</span>
              </div>
              <Space className={styles["history-diff-chips"]} size={[4, 4]} wrap>
                {addedShown.map((item) => (
                  <Tag
                    key={`a-${item.host}`}
                    className={`${styles["history-diff-chip"]} ${styles["history-diff-chip--added"]}`}
                  >
                    <span className={styles["history-diff-chip-host"]}>{item.host}</span>
                    <span className={styles["history-diff-chip-count"]}>×{item.count}</span>
                  </Tag>
                ))}
                {addedExtra > 0 && (
                  <Tag
                    className={`${styles["history-diff-chip"]} ${styles["history-diff-chip--more"]}`}
                  >
                    {t('还有 {n} 个', { n: addedExtra })}
                  </Tag>
                )}
              </Space>
            </div>
          )}
          {removedShown.length > 0 && (
            <div className={styles["history-diff-col"]}>
              <div
                className={`${styles["history-diff-col-title"]} ${styles["history-diff-col-title--removed"]}`}
              >
                <TrendingDown size={ICON_SIZE.TINY} />
                <span>{t('今天不再活跃')}</span>
              </div>
              <Space className={styles["history-diff-chips"]} size={[4, 4]} wrap>
                {removedShown.map((item) => (
                  <Tag
                    key={`r-${item.host}`}
                    className={`${styles["history-diff-chip"]} ${styles["history-diff-chip--removed"]}`}
                  >
                    <span className={styles["history-diff-chip-host"]}>{item.host}</span>
                    <span className={styles["history-diff-chip-count"]}>×{item.count}</span>
                  </Tag>
                ))}
                {removedExtra > 0 && (
                  <Tag
                    className={`${styles["history-diff-chip"]} ${styles["history-diff-chip--more"]}`}
                  >
                    {t('还有 {n} 个', { n: removedExtra })}
                  </Tag>
                )}
              </Space>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function HistoryPanel({ open, onClose }: HistoryPanelProps) {
  const { t } = useT();
  const { token } = theme.useToken();
  const relTime = useRelativeTime();

  const [activeTab, setActiveTab] = useState<"closed" | "timeline">("closed");
  const [keyword, setKeyword] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [closedTabs, setClosedTabs] = useState<ClosedTabRecord[]>([]);
  const [closedWindows, setClosedWindows] = useState<ClosedWindowRecord[]>([]);
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [snapshots, setSnapshots] = useState<DailySnapshot[]>([]);
  const [loading, setLoading] = useState(false);

  /**
   * 「昨天 → 今天」 diff：运行时计算，不落盘。
   * 不仅看「昨天 + 今天」，也允许「今天 vs 最近一次有记录的那天」：连着几天没启动也能提供变化感。
   */
  const snapshotDiff = useMemo<SnapshotDiff | null>(() => {
    if (snapshots.length < 2) return null;
    const todayKey = snapshotDateKey();
    const today = snapshots.find((s) => s.dateKey === todayKey) ?? snapshots[snapshots.length - 1];
    if (today === undefined) return null;
    const others = snapshots.filter((s) => s.dateKey !== today.dateKey);
    if (others.length === 0) return null;
    // 取与 today 最接近的一天作为对照组
    const yesterday = others.reduce((prev: DailySnapshot, cur: DailySnapshot) =>
      cur.dateKey > prev.dateKey ? cur : prev,
    );
    return diffSnapshots(yesterday, today);
  }, [snapshots]);

  /** 拉取数据 —— 打开面板时执行；后续也会被「恢复/删除/清空」操作主动 refresh */
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [tabs, windows, evts, snaps] = await Promise.all([
        getClosedTabs(),
        getClosedWindows(),
        getHistoryEvents(),
        getDailySnapshots(),
      ]);
      setClosedTabs(tabs);
      setClosedWindows(windows);
      setEvents(evts);
      setSnapshots(snaps);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  /** 关键词过滤的最近关闭 */
  const filteredClosedTabs = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (k === "") return closedTabs;
    return closedTabs.filter(
      (c) =>
        c.title.toLowerCase().includes(k) ||
        c.url.toLowerCase().includes(k) ||
        c.hostname.toLowerCase().includes(k),
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
      if (filterMode !== "all" && eventBucket(e.type) !== filterMode) return false;
      if (k === "") return true;
      const hay = [
        e.title ?? "",
        e.url ?? "",
        e.hostname ?? "",
        typeof e.extra?.query === "string" ? e.extra.query : "",
      ]
        .join(" ")
        .toLowerCase();
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

  // ── 操作处理 ─────────────────────────────────

  const handleRestoreOne = useCallback(
    async (rec: ClosedTabRecord) => {
      try {
        await createTab({ url: rec.url, active: true, pinned: rec.pinned });
        await deleteClosedTab(rec.id);
        feedback.success(t('已恢复 1 个标签页'));
        void refresh();
      } catch (err) {
        feedback.error(t('已恢复 1 个标签页'), err);
      }
    },
    [refresh, t],
  );

  const handleDeleteClosed = useCallback(
    async (rec: ClosedTabRecord) => {
      await deleteClosedTab(rec.id);
      void refresh();
    },
    [refresh],
  );

  const handleRestoreWindow = useCallback(
    async (win: ClosedWindowRecord) => {
      // 找到 win.tabIds 对应的 closed tabs，依次重开
      const targets = closedTabs.filter((c) => win.tabIds.includes(c.id));
      if (targets.length === 0) {
        feedback.warning(t('最近没有关闭过任何标签页'));
        return;
      }
      let success = 0;
      for (const c of targets) {
        try {
          await createTab({ url: c.url, active: false, pinned: c.pinned });
          await deleteClosedTab(c.id);
          success += 1;
        } catch {
          /* 单个失败不打断整体 */
        }
      }
      await deleteClosedWindow(win.id);
      feedback.success(t('已恢复 {count} 个标签页', { count: success }));
      void refresh();
    },
    [closedTabs, refresh, t],
  );

  const handleDeleteEvent = useCallback(
    async (id: string) => {
      await deleteHistoryEvent(id);
      void refresh();
    },
    [refresh],
  );

  /**
   * 「撤销」一条事件：
   *   1. 如果未注册该 type 的 handler→ 警告并提示（不会滩错 toast）
   *   2. handler 报错 / 返回 false → toast 失败
   *   3. 成功之后仅将事件标记为 undone，保留在时间线作为足迹
   */
  const handleUndoEvent = useCallback(
    async (e: HistoryEvent) => {
      if (!hasHistoryUndoHandler(e.type)) {
        feedback.warning(t('未注册撤销处理'));
        return;
      }
      try {
        const ok = await undoHistoryEvent(e);
        if (!ok) {
          feedback.warning(t('撤销失败'));
          return;
        }
        await markHistoryEventUndone(e.id);
        feedback.success(t('已撤销'));
        void refresh();
      } catch (err) {
        feedback.error(t('撤销失败'), err);
      }
    },
    [refresh, t],
  );

  const handleClearAll = useCallback(async () => {
    await clearAllNativeHistory();
    feedback.success(t('已清空历史记录'));
    void refresh();
  }, [refresh, t]);

  // ── 渲染 ────────────────────────────────────

  const headerExtra = (
    <div className={styles["history-panel-header-extra"]}>
      <Popconfirm
        title={t('确定要清空全部历史记录吗？此操作不可撤销。')}
        onConfirm={() => {
          void handleClearAll();
        }}
        okButtonProps={{ danger: true }}
      >
        <Button size="small" type="text" danger icon={<Trash2 size={ICON_SIZE.SMALL} />}>
          {t('清空全部')}
        </Button>
      </Popconfirm>
    </div>
  );

  const drawerVars = {
    "--history-accent": token.colorPrimary,
    "--history-text": token.colorText,
    "--history-text-secondary": token.colorTextSecondary,
    "--history-text-tertiary": token.colorTextTertiary,
    "--history-fill-secondary": token.colorFillSecondary,
    "--history-fill-tertiary": token.colorFillTertiary,
    "--history-border": token.colorBorderSecondary,
    "--history-radius": `${token.borderRadiusLG}px`,
  } as CSSProperties;

  const renderClosedItem = (rec: ClosedTabRecord) => (
    <div key={rec.id} className={styles["history-item"]}>
      {rec.favIconUrl !== "" ? (
        <Image
          src={rec.favIconUrl}
          alt=""
          className={styles["history-item-favicon"]}
          preview={false}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <span className={styles["history-item-favicon-fallback"]}>
          <Globe size={ICON_SIZE.SMALL} />
        </span>
      )}
      <div
        className={styles["history-item-main"]}
        onClick={() => {
          void handleRestoreOne(rec);
        }}
      >
        <div className={styles["history-item-title"]}>{rec.title || rec.url}</div>
        <div className={styles["history-item-subtitle"]}>
          <span>{rec.hostname || rec.url}</span>
          <span className={styles["history-item-dot"]}>·</span>
          <span>{relTime(rec.ts)}</span>
          {rec.pinned && (
            <Tag color="gold" className={styles["history-item-tag"]}>
              📌
            </Tag>
          )}
        </div>
      </div>
      <div className={styles["history-item-actions"]}>
        <Tooltip title={t('恢复')}>
          <Button
            type="text"
            size="small"
            icon={<RotateCcw size={ICON_SIZE.SMALL} />}
            onClick={() => {
              void handleRestoreOne(rec);
            }}
          />
        </Tooltip>
        <Tooltip title={t('删除')}>
          <Button
            type="text"
            size="small"
            icon={<X size={ICON_SIZE.SMALL} />}
            onClick={() => {
              void handleDeleteClosed(rec);
            }}
          />
        </Tooltip>
      </div>
    </div>
  );

  /** 整窗快照卡片（显示在最近关闭列表顶部） */
  const renderClosedWindow = (win: ClosedWindowRecord) => (
    <div key={`win-${win.id}`} className={styles["history-window-card"]}>
      <div className={styles["history-window-card-head"]}>
        <Layers size={ICON_SIZE.SMALL} />
        <span>{t('恢复整个窗口（{count} 个标签）', { count: win.tabCount })}</span>
        <span className={styles["history-item-dot"]}>·</span>
        <span className={styles["history-window-card-time"]}>{relTime(win.ts)}</span>
      </div>
      <Button
        size="small"
        type="primary"
        icon={<RotateCcw size={ICON_SIZE.SMALL} />}
        onClick={() => {
          void handleRestoreWindow(win);
        }}
      >
        {t('恢复')}
      </Button>
    </div>
  );

  /** 一条事件的描述文本（不同 type 不同模板） */
  const eventDescription = (e: HistoryEvent): string => {
    switch (e.type) {
      case "tab_opened":
        return t('打开了');
      case "tab_closed":
        return t('关闭了');
      case "window_closed":
        return t('关闭了一个窗口（{count} 个标签）', {
          count: typeof e.extra?.tabCount === "number" ? e.extra.tabCount : 0,
        });
      case "tab_pinned":
        return t('置顶了');
      case "tab_tagged":
        return t('加了标签');
      case "archive_create":
        return t('创建了归档');
      case "archive_restore":
        return t('恢复了归档');
      case "snapshot_create":
        return t('自动快照');
      case "search_query":
        return t('搜索了 "{query}"', {
          query: typeof e.extra?.query === "string" ? e.extra.query : "",
        });
      case "search_engine_open":
        return t('通过 {engine} 搜索了 "{query}"', {
          query: typeof e.extra?.query === "string" ? e.extra.query : "",
          engine: typeof e.extra?.engine === "string" ? e.extra.engine : "",
        });
      case "workspace_switch":
        return t('切换了工作区');
      default:
        return "";
    }
  };

  const renderEvent = (e: HistoryEvent) => {
    const isUndone = e.extra?.undone === true;
    return (
      <div key={e.id} className={`history-event${isUndone ? " is-undone" : ""}`}>
        <span className={styles["history-event-icon"]}>{eventIcon(e.type)}</span>
        <div
          className={styles["history-event-main"]}
          onClick={() => {
            if (e.url !== undefined && e.url !== "") {
              void createTab({ url: e.url, active: true });
            }
          }}
        >
          <div className={styles["history-event-line"]}>
            <span className={styles["history-event-action"]}>{eventDescription(e)}</span>
            {e.title !== undefined && e.title !== "" && (
              <span className={styles["history-event-target"]} title={e.url}>
                {e.title}
              </span>
            )}
            {isUndone && (
              <Tag color="default" className={styles["history-item-tag"]}>
                {t('已撤销')}
              </Tag>
            )}
          </div>
          <div className={styles["history-event-meta"]}>
            {e.hostname !== undefined && e.hostname !== "" && (
              <>
                <span>{e.hostname}</span>
                <span className={styles["history-item-dot"]}>·</span>
              </>
            )}
            <span>{relTime(e.ts)}</span>
          </div>
        </div>
        {e.undoable === true && !isUndone && (
          <Tooltip title={t('撤销')}>
            <Button
              type="text"
              size="small"
              icon={<Undo2 size={ICON_SIZE.SMALL} />}
              onClick={() => {
                void handleUndoEvent(e);
              }}
            />
          </Tooltip>
        )}
        <Tooltip title={t('删除')}>
          <Button
            type="text"
            size="small"
            icon={<X size={ICON_SIZE.SMALL} />}
            onClick={() => {
              void handleDeleteEvent(e.id);
            }}
          />
        </Tooltip>
      </div>
    );
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={520}
      title={
        <div className={styles["history-panel-title"]}>
          <History size={ICON_SIZE.MEDIUM} />
          <div>
            <div>{t('历史记录')}</div>
            <div className={styles["history-panel-subtitle"]}>{t('回看你在插件里做过什么，并一键恢复关闭的标签页')}</div>
          </div>
        </div>
      }
      extra={headerExtra}
      classNames={{
        mask: "history-drawer__mask",
        header: "history-drawer__header",
        title: "history-drawer__title",
        body: "history-panel-body",
        section: "history-drawer__section",
      }}
      rootClassName="history-panel-root"
    >
      <div className={styles["history-panel-shell"]} style={drawerVars}>
        <div className={styles["history-panel-toolbar"]}>
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={t('搜索历史…')}
            prefix={<Search size={ICON_SIZE.SMALL} />}
            allowClear
            size="middle"
          />
          <Tabs
            activeKey={activeTab}
            onChange={(k) => setActiveTab(k as "closed" | "timeline")}
            size="small"
            items={[
              { key: "closed", label: t('最近关闭') },
              { key: "timeline", label: t('操作时间线') },
            ]}
          />
          {activeTab === "timeline" && (
            <Segmented<FilterMode>
              size="small"
              value={filterMode}
              onChange={(v) => setFilterMode(v)}
              options={[
                { value: "all", label: t('全部') },
                { value: "tabs", label: t('标签操作') },
                { value: "search", label: t('搜索行为') },
                { value: "archive", label: t('归档/快照') },
              ]}
              block
            />
          )}
        </div>

        <div className={styles["history-panel-list"]}>
          {snapshotDiff !== null && <SnapshotDiffCard diff={snapshotDiff} t={t} />}
          {activeTab === "closed" ? (
            filteredClosedTabs.length === 0 && closedWindows.length === 0 ? (
              <Empty description={t('最近没有关闭过任何标签页')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <>
                {closedWindows.length > 0 && (
                  <div className={styles["history-window-list"]}>
                    {closedWindows.map(renderClosedWindow)}
                  </div>
                )}
                {TIME_GROUPS.map(({ id, labelKey }) => {
                  const list = groupedClosed.get(id);
                  if (!list || list.length === 0) return null;
                  return (
                    <section key={id} className={styles["history-group"]}>
                      <div className={styles["history-group-title"]}>{t(labelKey)}</div>
                      <div className={styles["history-list"]}>{list.map(renderClosedItem)}</div>
                    </section>
                  );
                })}
              </>
            )
          ) : filteredEvents.length === 0 ? (
            <Empty
              description={loading ? "..." : t('还没有任何历史记录')}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <div className={styles["history-empty-hint"]}>{t('正常使用一段时间后，这里会出现可恢复的最近关闭与操作流水')}</div>
            </Empty>
          ) : (
            TIME_GROUPS.map(({ id, labelKey }) => {
              const list = groupedEvents.get(id);
              if (!list || list.length === 0) return null;
              return (
                <section key={id} className={styles["history-group"]}>
                  <div className={styles["history-group-title"]}>{t(labelKey)}</div>
                  <div className={styles["history-list"]}>{list.map(renderEvent)}</div>
                </section>
              );
            })
          )}
        </div>
      </div>
    </Drawer>
  );
}
