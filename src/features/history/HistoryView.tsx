/**
 * HistoryView —— 浏览历史记录视图（v2.0 重构版）
 *
 * 模块结构：
 *   - components/ 展示组件（SnapshotDiffCard / ClosedTabItem / ClosedWindowCard / HistoryEventItem）
 *   - hooks/      状态管理（useHistorySource / useHistoryActions / useHistoryAnalysis / useSnapshotDiff / useHistoryPrefs）
 *   - utils/      工具函数（time-buckets / event-format）
 *
 * 设计目标：
 *   1. 以「最近关闭」为头号场景
 *   2. 提供操作时间线 + 按时间桶分组
 *   3. 全部本地数据，无远端请求
 *   4. 关注点分离，主组件仅做编排
 */

import { useMemo, useState } from "react";
import { Tabs, Input, Empty, Button, Segmented, Flex, Typography } from "antd";
import { Search, BarChart2 } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useT } from "@/shared/i18n";
import { useHistoryPrefs } from "./hooks/use-history-prefs";
import { useHistorySource } from "./hooks/use-history-source";
import { useHistoryActions } from "./hooks/use-history-actions";
import { useHistoryAnalysis } from "./hooks/use-history-analysis";
import { useSnapshotDiff } from "./hooks/use-snapshot-diff";
import { useRelativeTime, eventBucket } from "./utils/event-format";
import { bucketize, TIME_BUCKET_ORDER } from "./utils/time-buckets";
import type { TimeBucket } from "./utils/time-buckets";
import type { ClosedTabRecord, HistoryEvent } from "@/shared/types";

/** 事件过滤模式 */
type FilterMode = "all" | "tabs" | "search" | "archive";
import { HistoryAnalysisView } from "./components/HistoryAnalysisView";
import { SnapshotDiffCard } from "./components/SnapshotDiffCard";
import { ClosedTabItem } from "./components/ClosedTabItem";
import { ClosedWindowCard } from "./components/ClosedWindowCard";
import { HistoryEventItem } from "./components/HistoryEventItem";
import styles from "./HistoryView.module.less";

export function HistoryView() {
  const { t } = useT();
  const relTime = useRelativeTime();

  // ── 偏好 ──
  const { activeTab, setActiveTab } = useHistoryPrefs();

  // ── 数据源 ──
  const { closedTabs, closedWindows, events, snapshots, loading, refresh } =
    useHistorySource();

  // ── 分析 ──
  const {
    analysis,
    loading: analysisLoading,
    rangeMs: analysisRangeMs,
    setRangeMs: setAnalysisRangeMs,
  } = useHistoryAnalysis(7 * 24 * 3600 * 1000, activeTab === "analysis");

  // ── 快照 diff ──
  const snapshotDiff = useSnapshotDiff(snapshots);

  // ── 动作 ──
  const actions = useHistoryActions({ closedTabs, onAfterChange: refresh });

  // ── 局部 UI 状态 ──
  const [keyword, setKeyword] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [dateRange, setDateRange] = useState<{ start?: number; end?: number }>({});

  // ── 派生：时间桶分组标签 ──
  const timeGroups = useMemo(
    () =>
      TIME_BUCKET_ORDER.map((id) => ({
        id,
        label: t(
          id === "today"
            ? "今天"
            : id === "yesterday"
              ? "昨天"
              : id === "thisWeek"
                ? "本周"
                : "更早",
        ),
      })),
    [t],
  );

  const quickRangeLabels = useMemo(
    () => ({
      today: t("今天"),
      yesterday: t("昨天"),
      thisWeek: t("本周"),
      thisMonth: t("本月"),
    }),
    [t],
  );

  // ── 派生：过滤 ──
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

  const groupedClosed = useMemo(() => {
    const map = new Map<TimeBucket, ClosedTabRecord[]>();
    for (const item of filteredClosedTabs) {
      const b = bucketize(item.ts);
      const list = map.get(b) ?? [];
      list.push(item);
      map.set(b, list);
    }
    return map;
  }, [filteredClosedTabs]);

  const filteredEvents = useMemo(
    () =>
      events.filter((e) => {
        if (filterMode !== "all" && eventBucket(e.type) !== filterMode) return false;
        const k = keyword.trim().toLowerCase();
        if (k === "") {
          if (dateRange.start !== undefined) {
            return (
              e.ts >= dateRange.start &&
              (dateRange.end === undefined || e.ts <= dateRange.end)
            );
          }
          return true;
        }
        const hay = [
          e.title ?? "",
          e.url ?? "",
          e.hostname ?? "",
          typeof e.extra?.query === "string" ? e.extra.query : "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(k)) return false;
        if (dateRange.start !== undefined) {
          return (
            e.ts >= dateRange.start &&
            (dateRange.end === undefined || e.ts <= dateRange.end)
          );
        }
        return true;
      }),
    [events, filterMode, keyword, dateRange],
  );

  const groupedEvents = useMemo(() => {
    const map = new Map<TimeBucket, HistoryEvent[]>();
    for (const item of filteredEvents) {
      const b = bucketize(item.ts);
      const list = map.get(b) ?? [];
      list.push(item);
      map.set(b, list);
    }
    return map;
  }, [filteredEvents]);

  // ── 快捷时间范围 ──
  const quickRanges = useMemo(
    () =>
      (
        [
          { key: "today" as const, label: quickRangeLabels.today },
          { key: "yesterday" as const, label: quickRangeLabels.yesterday },
          { key: "thisWeek" as const, label: quickRangeLabels.thisWeek },
          { key: "thisMonth" as const, label: quickRangeLabels.thisMonth },
        ] as const
      ).map(({ key, label }) => ({
        key,
        label,
        onClick: () => {
          const d = new Date();
          let start = 0;
          if (key === "today") {
            d.setHours(0, 0, 0, 0);
            start = d.getTime();
          } else if (key === "yesterday") {
            d.setDate(d.getDate() - 1);
            d.setHours(0, 0, 0, 0);
            start = d.getTime();
          } else if (key === "thisWeek") {
            d.setDate(d.getDate() - d.getDay());
            d.setHours(0, 0, 0, 0);
            start = d.getTime();
          } else if (key === "thisMonth") {
            d.setDate(1);
            d.setHours(0, 0, 0, 0);
            start = d.getTime();
          }
          setDateRange(start > 0 ? { start, end: Date.now() } : {});
        },
      })),
    [quickRangeLabels],
  );

  const analysisLabel = (
    <Flex align="center" gap={4}>
      <BarChart2 size={12} />
      {t("分析")}
    </Flex>
  );

  return (
    <div style={{ minHeight: 0 }}>
      <Flex vertical className={styles["history-panel-shell"]}>
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
            onChange={(k) => setActiveTab(k as typeof activeTab)}
            size="small"
            items={[
              { key: "closed", label: t("最近关闭") },
              { key: "timeline", label: t("操作时间线") },
              { key: "analysis", label: analysisLabel },
            ]}
          />
          {activeTab === "timeline" && (
            <Flex gap={4} align="center" wrap>
              <Typography.Text
                type="secondary"
                style={{ marginRight: "var(--app-space-1)" }}
              >
                {t("时间范围")}:
              </Typography.Text>
              {quickRanges.map(({ key, label, onClick }) => (
                <Button
                  key={key}
                  size="small"
                  type={dateRange.start ? "default" : "text"}
                  onClick={onClick}
                >
                  {label}
                </Button>
              ))}
              {dateRange.start && (
                <Button size="small" type="text" onClick={() => setDateRange({})}>
                  {t("清除")}
                </Button>
              )}
            </Flex>
          )}
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
              onRangeChange={setAnalysisRangeMs}
              onExport={() => {
                void actions.exportJson(analysisRangeMs);
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
                    {closedWindows.map((win) => (
                      <ClosedWindowCard
                        key={win.id}
                        win={win}
                        relTime={relTime}
                        onRestore={(w) => {
                          void actions.restoreWindow(w);
                        }}
                      />
                    ))}
                  </Flex>
                )}
                {timeGroups.map(({ id, label }) => {
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
                        {label}
                      </Typography.Text>
                      <Flex vertical gap={2} className={styles["history-list"]}>
                        {list.map((rec) => (
                          <ClosedTabItem
                            key={rec.id}
                            rec={rec}
                            relTime={relTime}
                            onRestore={(r) => {
                              void actions.restoreOne(r);
                            }}
                            onDelete={(r) => {
                              void actions.deleteOne(r);
                            }}
                          />
                        ))}
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
            timeGroups.map(({ id, label }) => {
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
                    {label}
                  </Typography.Text>
                  <Flex vertical gap={2} className={styles["history-list"]}>
                    {list.map((e) => (
                      <HistoryEventItem
                        key={e.id}
                        e={e}
                        relTime={relTime}
                        onUndo={(ev) => {
                          void actions.undoEvent(ev);
                        }}
                        onDelete={(id) => {
                          void actions.deleteEvent(id);
                        }}
                      />
                    ))}
                  </Flex>
                </Flex>
              );
            })
          )}
        </Flex>
      </Flex>
    </div>
  );
}
