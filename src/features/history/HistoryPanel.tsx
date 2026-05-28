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
  Space,
  Flex,
  Typography,
  Select,
  Spin,
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
  BarChart2,
  Download,
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
  analyzeHistory,
  exportHistoryJson,
  reconcileFromChromeHistory,
} from "@/repositories";
import type { HistoryAnalysis } from "@/repositories";
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
      if (m < 1) return t("刚刚");
      if (m < 60) return t("{n} 分钟前", { n: m });
      const h = Math.floor(m / 60);
      if (h < 24) return t("{n} 小时前", { n: h });
      const d = Math.floor(h / 24);
      return t("{n} 天前", { n: d });
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
    <Flex vertical gap={10} className={styles["history-diff-card"]}>
      <Flex
        align="baseline"
        justify="space-between"
        gap={8}
        className={styles["history-diff-card-head"]}
      >
        <Flex align="center" gap={6} className={styles["history-diff-card-title"]}>
          <Camera size={ICON_SIZE.SMALL} />
          <Typography.Text>{t("昨天 → 今天")}</Typography.Text>
        </Flex>
        <Typography.Text className={styles["history-diff-card-subtitle"]}>
          {t("按站点汇总的使用变化")}
        </Typography.Text>
      </Flex>
      <Typography.Text className={styles["history-diff-card-total"]}>
        {t("总标签 {today}（昨天 {yesterday}，{sign}{delta}）", {
          today: diff.today.totalTabs,
          yesterday: diff.yesterday.totalTabs,
          sign,
          delta: Math.abs(diff.delta),
        })}
      </Typography.Text>
      {isFlat ? (
        <Typography.Text className={styles["history-diff-empty"]}>
          {t("两天访问的站点完全一致 ✨")}
        </Typography.Text>
      ) : (
        <div className={styles["history-diff-cols"]}>
          {addedShown.length > 0 && (
            <Flex vertical gap={6} className={styles["history-diff-col"]}>
              <Flex
                align="center"
                gap={4}
                className={`${styles["history-diff-col-title"]} ${styles["history-diff-col-title--added"]}`}
              >
                <TrendingUp size={ICON_SIZE.TINY} />
                <Typography.Text>{t("新开始访问")}</Typography.Text>
              </Flex>
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
                    {t("还有 {n} 个", { n: addedExtra })}
                  </Tag>
                )}
              </Space>
            </Flex>
          )}
          {removedShown.length > 0 && (
            <Flex vertical gap={6} className={styles["history-diff-col"]}>
              <Flex
                align="center"
                gap={4}
                className={`${styles["history-diff-col-title"]} ${styles["history-diff-col-title--removed"]}`}
              >
                <TrendingDown size={ICON_SIZE.TINY} />
                <Typography.Text>{t("今天不再活跃")}</Typography.Text>
              </Flex>
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
                    {t("还有 {n} 个", { n: removedExtra })}
                  </Tag>
                )}
              </Space>
            </Flex>
          )}
        </div>
      )}
    </Flex>
  );
}

export function HistoryPanel({ open, onClose }: HistoryPanelProps) {
  const { t } = useT();
  const { token } = theme.useToken();
  const relTime = useRelativeTime();

  const [activeTab, setActiveTab] = useState<"closed" | "timeline" | "analysis">("closed");
  const [keyword, setKeyword] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [closedTabs, setClosedTabs] = useState<ClosedTabRecord[]>([]);
  const [closedWindows, setClosedWindows] = useState<ClosedWindowRecord[]>([]);
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [snapshots, setSnapshots] = useState<DailySnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  // 任务6：分析视图状态
  const [analysis, setAnalysis] = useState<HistoryAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisRangeMs, setAnalysisRangeMs] = useState(7 * 24 * 3600 * 1000);

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
      // 任务6：静默对账 chrome.history（不阻塞主流程）
      void reconcileFromChromeHistory(24 * 3600 * 1000);
    } finally {
      setLoading(false);
    }
  }, []);

  /** 任务6：加载分析数据 */
  const loadAnalysis = useCallback(async (rangeMs: number) => {
    setAnalysisLoading(true);
    try {
      const result = await analyzeHistory(rangeMs);
      setAnalysis(result);
    } finally {
      setAnalysisLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (activeTab === "analysis" && open) {
      void loadAnalysis(analysisRangeMs);
    }
  }, [activeTab, open, analysisRangeMs, loadAnalysis]);

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
        feedback.success(t("已恢复 1 个标签页"));
        void refresh();
      } catch (err) {
        feedback.error(t("已恢复 1 个标签页"), err);
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
        feedback.warning(t("最近没有关闭过任何标签页"));
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
      feedback.success(t("已恢复 {count} 个标签页", { count: success }));
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
        feedback.warning(t("未注册撤销处理"));
        return;
      }
      try {
        const ok = await undoHistoryEvent(e);
        if (!ok) {
          feedback.warning(t("撤销失败"));
          return;
        }
        await markHistoryEventUndone(e.id);
        feedback.success(t("已撤销"));
        void refresh();
      } catch (err) {
        feedback.error(t("撤销失败"), err);
      }
    },
    [refresh, t],
  );

  const handleClearAll = useCallback(async () => {
    await clearAllNativeHistory();
    feedback.success(t("已清空历史记录"));
    void refresh();
  }, [refresh, t]);

  /** 任务6：导出历史 JSON */
  const handleExportJson = useCallback(async () => {
    try {
      const json = await exportHistoryJson({ rangeMs: analysisRangeMs });
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tabs-history-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      feedback.success(t("导出成功"));
    } catch (err) {
      feedback.error(t("导出失败"), err);
    }
  }, [analysisRangeMs, t]);

  // ── 渲染 ────────────────────────────────────

  const headerExtra = (
    <Flex align="center" gap={6} className={styles["history-panel-header-extra"]}>
      <Popconfirm
        title={t("确定要清空全部历史记录吗？此操作不可撤销。")}
        onConfirm={() => {
          void handleClearAll();
        }}
        okButtonProps={{ danger: true }}
      >
        <Button size="small" type="text" danger icon={<Trash2 size={ICON_SIZE.SMALL} />}>
          {t("清空全部")}
        </Button>
      </Popconfirm>
    </Flex>
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
    <Flex key={rec.id} align="center" gap={10} className={styles["history-item"]}>
      <span className={styles["history-item-favicon-wrap"]}>
        {rec.favIconUrl !== "" ? (
          <img
            src={rec.favIconUrl}
            alt=""
            className={styles["history-item-favicon"]}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
              const fallback = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = "inline-flex";
            }}
          />
        ) : null}
        <span
          className={styles["history-item-favicon-fallback"]}
          style={rec.favIconUrl !== "" ? { display: "none" } : undefined}
        >
          <Globe size={ICON_SIZE.SMALL} />
        </span>
      </span>
      <Flex
        vertical
        gap={2}
        className={styles["history-item-main"]}
        onClick={() => {
          void handleRestoreOne(rec);
        }}
      >
        <Flex align="center" gap={6} className={styles["history-item-title"]}>
          {rec.title || rec.url}
        </Flex>
        <Flex align="center" gap={4} className={styles["history-item-subtitle"]}>
          <Typography.Text>{rec.hostname || rec.url}</Typography.Text>
          <Typography.Text className={styles["history-item-dot"]}>·</Typography.Text>
          <Typography.Text>{relTime(rec.ts)}</Typography.Text>
          {rec.pinned && (
            <Tag color="gold" className={styles["history-item-tag"]}>
              📌
            </Tag>
          )}
        </Flex>
      </Flex>
      <Flex gap={2} className={styles["history-item-actions"]}>
        <Tooltip title={t("恢复")}>
          <Button
            type="text"
            size="small"
            icon={<RotateCcw size={ICON_SIZE.SMALL} />}
            onClick={() => {
              void handleRestoreOne(rec);
            }}
          />
        </Tooltip>
        <Tooltip title={t("删除")}>
          <Button
            type="text"
            size="small"
            icon={<X size={ICON_SIZE.SMALL} />}
            onClick={() => {
              void handleDeleteClosed(rec);
            }}
          />
        </Tooltip>
      </Flex>
    </Flex>
  );

  /** 整窗快照卡片（显示在最近关闭列表顶部） */
  const renderClosedWindow = (win: ClosedWindowRecord) => (
    <Flex
      key={`win-${win.id}`}
      align="center"
      justify="space-between"
      className={styles["history-window-card"]}
    >
      <Flex align="center" gap={8} className={styles["history-window-card-head"]}>
        <Layers size={ICON_SIZE.SMALL} />
        <Typography.Text>
          {t("恢复整个窗口（{count} 个标签）", { count: win.tabCount })}
        </Typography.Text>
        <Typography.Text className={styles["history-item-dot"]}>·</Typography.Text>
        <Typography.Text className={styles["history-window-card-time"]}>
          {relTime(win.ts)}
        </Typography.Text>
      </Flex>
      <Button
        size="small"
        type="primary"
        icon={<RotateCcw size={ICON_SIZE.SMALL} />}
        onClick={() => {
          void handleRestoreWindow(win);
        }}
      >
        {t("恢复")}
      </Button>
    </Flex>
  );

  /** 一条事件的描述文本（不同 type 不同模板） */
  const eventDescription = (e: HistoryEvent): string => {
    switch (e.type) {
      case "tab_opened":
        return t("打开了");
      case "tab_closed":
        return t("关闭了");
      case "window_closed":
        return t("关闭了一个窗口（{count} 个标签）", {
          count: typeof e.extra?.tabCount === "number" ? e.extra.tabCount : 0,
        });
      case "tab_pinned":
        return t("置顶了");
      case "tab_tagged":
        return t("加了标签");
      case "archive_create":
        return t("创建了归档");
      case "archive_restore":
        return t("恢复了归档");
      case "snapshot_create":
        return t("自动快照");
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
        return t("切换了工作区");
      default:
        return "";
    }
  };

  const renderEvent = (e: HistoryEvent) => {
    const isUndone = e.extra?.undone === true;
    return (
      <Flex
        key={e.id}
        align="center"
        gap={10}
        className={`${styles["history-event"]}${isUndone ? ` ${styles["is-undone"]}` : ""}`}
      >
        <Typography.Text className={styles["history-event-icon"]}>
          {eventIcon(e.type)}
        </Typography.Text>
        <Flex
          vertical
          gap={2}
          className={styles["history-event-main"]}
          onClick={() => {
            if (e.url !== undefined && e.url !== "") {
              void createTab({ url: e.url, active: true });
            }
          }}
        >
          <Flex align="center" gap={6} className={styles["history-event-line"]}>
            <Typography.Text className={styles["history-event-action"]}>
              {eventDescription(e)}
            </Typography.Text>
            {e.title !== undefined && e.title !== "" && (
              <Typography.Text className={styles["history-event-target"]} title={e.url}>
                {e.title}
              </Typography.Text>
            )}
            {isUndone && (
              <Tag color="default" className={styles["history-item-tag"]}>
                {t("已撤销")}
              </Tag>
            )}
          </Flex>
          <Flex align="center" gap={4} className={styles["history-event-meta"]}>
            {e.hostname !== undefined && e.hostname !== "" && (
              <>
                <Typography.Text>{e.hostname}</Typography.Text>
                <Typography.Text className={styles["history-item-dot"]}>·</Typography.Text>
              </>
            )}
            <Typography.Text>{relTime(e.ts)}</Typography.Text>
          </Flex>
        </Flex>
        {e.undoable === true && !isUndone && (
          <Tooltip title={t("撤销")}>
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
        <Tooltip title={t("删除")}>
          <Button
            type="text"
            size="small"
            icon={<X size={ICON_SIZE.SMALL} />}
            onClick={() => {
              void handleDeleteEvent(e.id);
            }}
          />
        </Tooltip>
      </Flex>
    );
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={520}
      title={
        <Flex align="center" gap={10} className={styles["history-panel-title"]}>
          <History size={ICON_SIZE.MEDIUM} />
          <Flex vertical>
            <Typography.Text>{t("历史记录")}</Typography.Text>
            <Typography.Text className={styles["history-panel-subtitle"]}>
              {t("回看你在插件里做过什么，并一键恢复关闭的标签页")}
            </Typography.Text>
          </Flex>
        </Flex>
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
      <Flex vertical className={styles["history-panel-shell"]} style={drawerVars}>
        <Flex vertical gap={10} className={styles["history-panel-toolbar"]}>
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={t("搜索历史…")}
            prefix={<Search size={ICON_SIZE.SMALL} />}
            allowClear
            size="middle"
          />
          <Tabs
            activeKey={activeTab}
            onChange={(k) => setActiveTab(k as "closed" | "timeline" | "analysis")}
            size="small"
            items={[
              { key: "closed", label: t("最近关闭") },
              { key: "timeline", label: t("操作时间线") },
              {
                key: "analysis",
                label: (
                  <Flex align="center" gap={4}>
                    <BarChart2 size={12} />
                    {t("分析")}
                  </Flex>
                ),
              },
            ]}
          />
          {activeTab === "timeline" && (
            <Segmented<FilterMode>
              size="small"
              value={filterMode}
              onChange={(v) => setFilterMode(v)}
              options={[
                { value: "all", label: t("全部") },
                { value: "tabs", label: t("标签操作") },
                { value: "search", label: t("搜索行为") },
                { value: "archive", label: t("归档/快照") },
              ]}
              block
            />
          )}
        </Flex>

        <Flex vertical gap={16} className={styles["history-panel-list"]}>
          {snapshotDiff !== null && activeTab !== "analysis" && (
            <SnapshotDiffCard diff={snapshotDiff} t={t} />
          )}
          {activeTab === "analysis" ? (
            <HistoryAnalysisView
              analysis={analysis}
              loading={analysisLoading}
              rangeMs={analysisRangeMs}
              onRangeChange={(v) => setAnalysisRangeMs(v)}
              onExport={() => {
                void handleExportJson();
              }}
              t={t}
              styles={styles}
            />
          ) : activeTab === "closed" ? (
            filteredClosedTabs.length === 0 && closedWindows.length === 0 ? (
              <Empty
                description={t("最近没有关闭过任何标签页")}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <>
                {closedWindows.length > 0 && (
                  <Flex vertical gap={2} className={styles["history-window-list"]}>
                    {closedWindows.map(renderClosedWindow)}
                  </Flex>
                )}
                {TIME_GROUPS.map(({ id, labelKey }) => {
                  const list = groupedClosed.get(id);
                  if (!list || list.length === 0) return null;
                  return (
                    <Flex
                      key={id}
                      vertical
                      gap={4}
                      component="section"
                      className={styles["history-group"]}
                    >
                      <Typography.Text className={styles["history-group-title"]}>
                        {t(labelKey)}
                      </Typography.Text>
                      <Flex vertical gap={2} className={styles["history-list"]}>
                        {list.map(renderClosedItem)}
                      </Flex>
                    </Flex>
                  );
                })}
              </>
            )
          ) : filteredEvents.length === 0 ? (
            <Empty
              description={loading ? "..." : t("还没有任何历史记录")}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <div className={styles["history-empty-hint"]}>
                {t("正常使用一段时间后，这里会出现可恢复的最近关闭与操作流水")}
              </div>
            </Empty>
          ) : (
            TIME_GROUPS.map(({ id, labelKey }) => {
              const list = groupedEvents.get(id);
              if (!list || list.length === 0) return null;
              return (
                <Flex
                  key={id}
                  vertical
                  gap={4}
                  component="section"
                  className={styles["history-group"]}
                >
                  <Typography.Text className={styles["history-group-title"]}>
                    {t(labelKey)}
                  </Typography.Text>
                  <Flex vertical gap={2} className={styles["history-list"]}>
                    {list.map(renderEvent)}
                  </Flex>
                </Flex>
              );
            })
          )}
        </Flex>
      </Flex>
    </Drawer>
  );
}

// ── 任务6：多维历史分析视图组件 ──────────────────────────

interface HistoryAnalysisViewProps {
  analysis: HistoryAnalysis | null;
  loading: boolean;
  rangeMs: number;
  onRangeChange: (v: number) => void;
  onExport: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  styles: Record<string, string>;
}

const RANGE_OPTIONS = [
  { value: 1 * 24 * 3600 * 1000, label: "今天" },
  { value: 7 * 24 * 3600 * 1000, label: "近 7 天" },
  { value: 14 * 24 * 3600 * 1000, label: "近 14 天" },
  { value: 30 * 24 * 3600 * 1000, label: "近 30 天" },
];

function HistoryAnalysisView({
  analysis,
  loading,
  rangeMs,
  onRangeChange,
  onExport,
  t,
  styles,
}: HistoryAnalysisViewProps): ReactNode {
  if (loading) {
    return (
      <Flex align="center" justify="center" className={styles["history-loading-center"]}>
        <Spin size="default" />
      </Flex>
    );
  }

  if (analysis === null || analysis.totalEvents === 0) {
    return (
      <Flex vertical gap={12} className={styles["history-analysis-panel"]}>
        <Flex align="center" justify="space-between" className={styles["history-analysis-header"]}>
          <Select
            size="small"
            value={rangeMs}
            onChange={onRangeChange}
            options={RANGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            className={styles["history-date-picker"]}
          />
          <Button size="small" icon={<Download size={12} />} onClick={onExport}>
            {t("导出")}
          </Button>
        </Flex>
        <Empty description={t("暂无数据")} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Flex>
    );
  }

  const maxDayCount = Math.max(...analysis.byDay.map((d) => d.count), 1);
  const maxHourCount = Math.max(...analysis.byHour.map((h) => h.count), 1);
  const topHosts = analysis.byHost.slice(0, 10);
  const maxHostCount = topHosts[0]?.visitCount ?? 1;

  return (
    <Flex vertical gap={16} className={styles["history-analysis-panel"]}>
      {/* 顶部：范围选择 + 导出 */}
      <Flex align="center" justify="space-between" className={styles["history-analysis-header"]}>
        <Flex align="center" gap={8}>
          <Select
            size="small"
            value={rangeMs}
            onChange={onRangeChange}
            options={RANGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            className={styles["history-date-picker"]}
          />
          <Typography.Text className={styles["history-stat-text"]}>
            {t("共 {n} 条记录", { n: analysis.totalEvents })}
          </Typography.Text>
        </Flex>
        <Button size="small" icon={<Download size={12} />} onClick={onExport}>
          {t("导出 JSON")}
        </Button>
      </Flex>

      {/* 每日趋势柱状图 */}
      <Flex vertical gap={6} className={styles["history-analysis-section"]}>
        <Typography.Text className={styles["history-analysis-section-title"]}>
          <BarChart2 size={12} />
          {t("每日活动趋势（近 14 天）")}
        </Typography.Text>
        <div className={styles["history-day-chart"]}>
          {analysis.byDay.map((day) => {
            const heightPct = maxDayCount > 0 ? (day.count / maxDayCount) * 100 : 0;
            const shortLabel = day.label.slice(5); // MM-DD
            return (
              <Tooltip
                key={day.label}
                title={`${day.label}：${day.count} 条，${day.uniqueHosts} 个站点`}
              >
                <div className={styles["history-day-bar-wrap"]}>
                  <div
                    className={styles["history-day-bar"]}
                    style={{ height: `${Math.max(heightPct, 2)}%` }}
                  />
                  <span className={styles["history-day-label"]}>{shortLabel}</span>
                </div>
              </Tooltip>
            );
          })}
        </div>
      </Flex>

      {/* 小时热力分布 */}
      <Flex vertical gap={6} className={styles["history-analysis-section"]}>
        <Typography.Text className={styles["history-analysis-section-title"]}>
          <Clock size={12} />
          {t("活跃时段分布（24 小时）")}
        </Typography.Text>
        <div className={styles["history-hour-grid"]}>
          {analysis.byHour.map((hour) => {
            const intensity = maxHourCount > 0 ? hour.count / maxHourCount : 0;
            const bg = `color-mix(in srgb, var(--ant-color-primary) ${Math.round(intensity * 80 + 8)}%, transparent)`;
            return (
              <Tooltip key={hour.label} title={`${hour.label}：${hour.count} 条`}>
                <div className={styles["history-hour-cell"]} style={{ background: bg }}>
                  {hour.label.slice(0, 2)}
                </div>
              </Tooltip>
            );
          })}
        </div>
      </Flex>

      {/* 站点访问排行 */}
      <Flex vertical gap={6} className={styles["history-analysis-section"]}>
        <Typography.Text className={styles["history-analysis-section-title"]}>
          <Globe size={12} />
          {t("站点访问排行")}
        </Typography.Text>
        <div className={styles["history-host-list"]}>
          {topHosts.map((item, idx) => (
            <div key={item.host} className={styles["history-host-item"]}>
              <span
                className={`${styles["history-host-rank"]}${idx < 3 ? ` ${styles["history-host-rank--top"]}` : ""}`}
              >
                {idx + 1}
              </span>
              <span className={styles["history-host-name"]}>{item.host}</span>
              <div className={styles["history-host-bar-wrap"]}>
                <div
                  className={styles["history-host-bar"]}
                  style={{ width: `${(item.visitCount / maxHostCount) * 100}%` }}
                />
              </div>
              <span className={styles["history-host-count"]}>{item.visitCount}</span>
            </div>
          ))}
        </div>
      </Flex>
    </Flex>
  );
}
