/**
 * ArchiveView — 归档会话内联视图（v2: dashboard）
 *
 * 布局：
 *   archive-shell
 *     ├ ArchiveSidebar  ← 左侧时间筛选 + 自动快照分区
 *     └ archive-main
 *         ├ ArchiveStats  ← 顶部 KPI 4 卡
 *         ├ Toolbar      ← 搜索 + 排序 + 多选 + 归档当前
 *         └ TimeGroups   ← 按时段分组的 SessionCard 网格
 *
 * 业务逻辑保留：搜索 / 批量选择 / 合并 / 恢复 / 重命名 / 分享 / 归档当前。
 */

import { useState, useEffect, useMemo } from "react";
import { Plus, Save, Inbox, ArrowDownUp } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { Button, Spin, Input, Modal, Typography, Select, Empty, Flex } from "antd";
import { FeatureEmptyState } from "@/shared/ui/FeatureEmptyState";
import type { ArchivedSession } from "@/shared/types";
import { archiveAllTabs } from "@/services";
import type { RestoreOutcome } from "@/services/archive";
import { createTab, getCurrentWindow } from "@/chrome";
import { useT } from "@/shared/i18n";
import { track } from "@/shared/utils/metrics";
import { useTabsStore, useUndoStore, useMetadataStore, useSettingsStore, useSessionsStore } from "@/store";
import { feedback } from "@/shared/ui/feedback";
import { appendHistoryEvent } from "@/repositories";
import { SessionCard } from "./components/SessionCard";
import { ArchiveStats, type ArchiveFilterId } from "./components/ArchiveStats";
import { ArchiveSidebar } from "./components/ArchiveSidebar";
import { BatchOperationsMenu } from "./components/BatchOperationsMenu";
import { EnhancedRestoreDialog } from "./components/EnhancedRestoreDialog";
import { EnhancedRenameDialog } from "./components/EnhancedRenameDialog";
import { APP_EVENTS } from "@/shared/config/storage-keys";
import { isSafeExternalUrl } from "@/shared/utils/url-safety";
import styles from "./styles/archive.module.less";

/** Sidebar 选中的扩展过滤标识，比 ArchiveFilterId 多一个 earlier。 */
type ArchiveScopeId = ArchiveFilterId | "earlier";

/** 排序模式 */
type SortMode = "newest" | "oldest" | "largest" | "name";

/** 时段分组 key，用于渲染分段标题。 */
type TimeBucket = "today" | "yesterday" | "thisWeek" | "thisMonth" | "earlier";

interface BucketEntry {
  key: TimeBucket;
  labelKey: string;
  sessions: ArchivedSession[];
}

function bucketOf(
  ts: number,
  refs: { today: number; yesterday: number; weekStart: number; monthStart: number },
): TimeBucket {
  if (ts >= refs.today) return "today";
  if (ts >= refs.yesterday) return "yesterday";
  if (ts >= refs.weekStart) return "thisWeek";
  if (ts >= refs.monthStart) return "thisMonth";
  return "earlier";
}

export function ArchiveView() {
  const sessions = useSessionsStore((s) => s.sessions);
  const loading = useSessionsStore((s) => s.loading);
  const refreshSessions = useSessionsStore((s) => s.refreshSessions);
  const deleteSessionSlice = useSessionsStore((s) => s.deleteSession);
  const mergeSessionsSlice = useSessionsStore((s) => s.mergeSessions);
  const exportSessionSlice = useSessionsStore((s) => s.exportSession);
  const [archivingCurrent, setArchivingCurrent] = useState(false);
  /** 多选 */
  const [selectable, setSelectable] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  /** 高亮（外部跳转） */
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeName, setMergeName] = useState("");
  /** 增强对话框 */
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [restoringSession, setRestoringSession] = useState<ArchivedSession | null>(null);
  const [renamingDialogOpen, setRenamingDialogOpen] = useState(false);
  const [renamingSession, setRenamingSession] = useState<ArchivedSession | null>(null);
  /** 卡片展开状态（详情 tab 列表） */
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  /** 搜索 */
  const [searchQuery, setSearchQuery] = useState("");
  /** 当前分类 */
  const [scope, setScope] = useState<ArchiveScopeId>("all");
  /** 排序 */
  const [sortMode, setSortMode] = useState<SortMode>("newest");

  const loadAllTabs = useTabsStore((s) => s.loadAllTabs);
  const tabCount = useTabsStore((s) => s.tabs.length);
  const { t, locale } = useT();

  useEffect(() => {
    void refreshSessions();
  }, []);

  /** 跳转高亮事件 */
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ sessionId?: string }>).detail;
      if (detail?.sessionId !== undefined) {
        setHighlightId(detail.sessionId);
        window.setTimeout(() => setHighlightId(null), 3000);
      }
    };
    window.addEventListener(APP_EVENTS.highlightSession, handler);
    return () => window.removeEventListener(APP_EVENTS.highlightSession, handler);
  }, []);

  /** 拼音匹配 */
  const enablePinyin = useSettingsStore((s) => s.settings.searchEnablePinyin ?? true);
  const [pinyinMatchFn, setPinyinMatchFn] = useState<
    ((text: string, query: string) => boolean) | null
  >(null);

  useEffect(() => {
    if (!enablePinyin || pinyinMatchFn !== null) return;
    void (async () => {
      const { pinyinMatch } = await import("@/shared/utils/pinyin");
      setPinyinMatchFn(() => pinyinMatch);
    })();
  }, [enablePinyin, pinyinMatchFn]);

  /** 搜索过滤 */
  const isSearching = searchQuery.trim().length > 0;
  const { searchFiltered, matchedTabIndexes } = useMemo(() => {
    if (!isSearching) {
      return { searchFiltered: sessions, matchedTabIndexes: new Map<string, Set<number>>() };
    }
    const query = searchQuery.toLowerCase().trim();
    const result: ArchivedSession[] = [];
    const matched = new Map<string, Set<number>>();
    for (const session of sessions) {
      const matchedIdxs = new Set<number>();
      const nameMatch =
        session.name.toLowerCase().includes(query) ||
        (enablePinyin && pinyinMatchFn?.(session.name, query));
      for (let i = 0; i < session.tabs.length; i++) {
        const tab = session.tabs[i];
        if (!tab) continue;
        const titleMatch = tab.title?.toLowerCase().includes(query) ?? false;
        const pinyinTitleMatch =
          enablePinyin && pinyinMatchFn !== null && tab.title && pinyinMatchFn(tab.title, query);
        const urlMatch = tab.url.toLowerCase().includes(query);
        if (titleMatch || pinyinTitleMatch || urlMatch) {
          matchedIdxs.add(i);
        }
      }
      if (nameMatch || matchedIdxs.size > 0) {
        result.push(session);
        matched.set(session.id, matchedIdxs);
      }
    }
    return { searchFiltered: result, matchedTabIndexes: matched };
  }, [sessions, isSearching, searchQuery, enablePinyin, pinyinMatchFn]);

  /** 按 sidebar scope 二次筛选 */
  const scopeFiltered = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = startOfToday - 6 * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return searchFiltered.filter((s) => {
      const isAuto = s.source === "auto" || s.hidden === true;
      if (scope === "auto") return isAuto;
      if (isAuto) return false; // 普通 scope 不展示 auto
      if (scope === "all") return true;
      if (scope === "today") return s.createdAt >= startOfToday;
      if (scope === "week") return s.createdAt >= startOfWeek;
      if (scope === "month") return s.createdAt >= startOfMonth;
      if (scope === "earlier") return s.createdAt < startOfMonth;
      return true;
    });
  }, [searchFiltered, scope]);

  /** 排序 */
  const sortedSessions = useMemo(() => {
    const arr = [...scopeFiltered];
    arr.sort((a, b) => {
      switch (sortMode) {
        case "oldest":
          return a.createdAt - b.createdAt;
        case "largest":
          return b.tabCount - a.tabCount;
        case "name":
          return a.name.localeCompare(b.name);
        case "newest":
        default:
          return b.createdAt - a.createdAt;
      }
    });
    return arr;
  }, [scopeFiltered, sortMode]);

  /** 时段分组（仅 newest/oldest 排序时分组；按数量/名称排序时不分段，避免割裂） */
  const buckets = useMemo<BucketEntry[]>(() => {
    if (sortMode === "largest" || sortMode === "name") {
      return [
        {
          key: "today",
          labelKey:
            sortMode === "largest" ? "archive.toolbar.sortLargest" : "archive.toolbar.sortName",
          sessions: sortedSessions,
        },
      ];
    }
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const refs = {
      today,
      yesterday: today - 24 * 60 * 60 * 1000,
      weekStart: today - 6 * 24 * 60 * 60 * 1000,
      monthStart: new Date(now.getFullYear(), now.getMonth(), 1).getTime(),
    };
    const map = new Map<TimeBucket, ArchivedSession[]>();
    for (const s of sortedSessions) {
      const key = bucketOf(s.createdAt, refs);
      const list = map.get(key);
      if (list) list.push(s);
      else map.set(key, [s]);
    }
    const order: Array<{ key: TimeBucket; labelKey: string }> = [
      { key: "today", labelKey: "archive.timeGroup.today" },
      { key: "yesterday", labelKey: "archive.timeGroup.yesterday" },
      { key: "thisWeek", labelKey: "archive.timeGroup.thisWeek" },
      { key: "thisMonth", labelKey: "archive.timeGroup.thisMonth" },
      { key: "earlier", labelKey: "archive.timeGroup.earlier" },
    ];
    const out: BucketEntry[] = [];
    for (const o of order) {
      const list = map.get(o.key);
      if (list && list.length > 0) {
        out.push({ key: o.key, labelKey: o.labelKey, sessions: list });
      }
    }
    return out;
  }, [sortedSessions, sortMode]);

  /** 搜索时自动展开命中卡片 */
  useEffect(() => {
    if (!isSearching) return;
    const next = new Set<string>();
    for (const s of sortedSessions) {
      if (matchedTabIndexes.has(s.id)) next.add(s.id);
    }
    setExpandedSessions(next);
  }, [isSearching, sortedSessions, matchedTabIndexes]);

  const handleRestore = (id: string) => {
    const session = sessions.find((s) => s.id === id);
    if (session) {
      setRestoringSession(session);
      setRestoreDialogOpen(true);
    }
  };

  const handleEnhancedRestoreComplete = async (outcome: RestoreOutcome) => {
    await refreshSessions();
    const total = restoringSession?.tabCount ?? outcome.restored;
    void track("archive_restore", { restored: outcome.restored, total });
    if (outcome.cancelled) {
      feedback.info(t("已取消恢复，成功恢复 {restored} 个标签", { restored: outcome.restored }));
    } else if (outcome.restored === total) {
      feedback.success(t("恢复成功"));
    } else {
      feedback.warning(
        t("部分恢复成功，已恢复 {restored}/{total} 个标签", { restored: outcome.restored, total }),
      );
    }
    setRestoreDialogOpen(false);
    setRestoringSession(null);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSessionSlice(id);
      void track("archive_delete");
    } catch (err) {
      feedback.error(t("删除失败，请重试"), err);
    }
  };

  const handleShare = async (id: string) => {
    try {
      await exportSessionSlice(id);
    } catch {
      /* exportSessionSlice 内部已经 feedback.error */
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const cancelSelect = () => {
    setSelectable(false);
    setSelectedIds(new Set());
  };

  const handleSelectModeChange = (enabled: boolean) => {
    if (enabled) {
      setSelectable(true);
      return;
    }
    cancelSelect();
  };

  const handleOpenMerge = (ids: string[]) => {
    if (ids.length < 2) {
      feedback.warning(t("请至少选择 2 个会话"));
      return;
    }
    setSelectedIds(new Set(ids));
    setMergeName(t("合并会话"));
    setMergeOpen(true);
  };

  const handleConfirmMerge = async () => {
    try {
      const newSession = await mergeSessionsSlice(Array.from(selectedIds), mergeName);
      if (newSession === null) {
        feedback.error(t("合并失败，请重试"));
        return;
      }
      void track("archive_merge", { count: selectedIds.size });
      setMergeOpen(false);
      cancelSelect();
      feedback.success(t("已合并为 1 个会话，共 {count} 个标签", { count: newSession.tabCount }));
      void useMetadataStore.getState().pushActivity({
        id: `merge-${newSession.id}`,
        type: "archive",
        ts: Date.now(),
        summary: t("已合并为「{name}」（{count} 个标签）", {
          count: newSession.tabCount,
          name: newSession.name,
        }),
      });
    } catch (err) {
      feedback.error(t("合并失败，请重试"), err);
    }
  };

  const startRenaming = (session: ArchivedSession) => {
    setRenamingSession(session);
    setRenamingDialogOpen(true);
  };

  const handleOpenSingle = async (tab: { url: string }) => {
    if (!isSafeExternalUrl(tab.url)) {
      feedback.error(t("恢复失败，请重试"));
      return;
    }
    try {
      const currentWindow = await getCurrentWindow();
      await createTab({ url: tab.url, windowId: currentWindow?.id, active: true });
    } catch (err) {
      feedback.error(t("恢复失败，请重试"), err);
    }
  };

  const handleArchiveCurrent = async () => {
    if (archivingCurrent || tabCount === 0) return;
    setArchivingCurrent(true);
    try {
      const result = await archiveAllTabs();
      void track("archive_create", { count: result.archivedCount });
      const { archivedCount, closedCount, session } = result;
      void appendHistoryEvent({
        type: "archive_create",
        title: session.name,
        extra: { count: archivedCount, sessionId: session.id },
        undoable: true,
        undoContext: { sessionId: session.id },
      });
      await loadAllTabs({ silent: true });
      await refreshSessions();

      const snapshots = session.tabs.map((tab) => ({
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl,
        windowId: 0,
        pinned: tab.pinned,
      }));
      const failCount = archivedCount - closedCount;
      const subNote =
        failCount > 0
          ? t("已有 {count} 个标签页未能关闭，可稍后手动处理", { count: failCount })
          : "";
      void useUndoStore
        .getState()
        .addRecord(
          snapshots,
          t("已归档 {count} 个标签到「{name}」", { count: archivedCount, name: session.name }),
          { archivedSessionId: session.id, subNote },
        );

      void useMetadataStore.getState().pushActivity({
        id: `archive-${session.id}`,
        type: "archive",
        ts: Date.now(),
        summary: t("已归档 {count} 个标签到「{name}」", {
          count: archivedCount,
          name: session.name,
        }),
        primaryAction: {
          id: "view",
          label: t("查看归档"),
          kind: "open_archive",
          payload: session.id,
        },
      });
    } catch (err) {
      feedback.error(t("归档失败，请重试"), err);
    } finally {
      setArchivingCurrent(false);
    }
  };

  /** Stats 卡片 → 同步切 sidebar scope */
  const handleSelectStatsFilter = (filter: ArchiveFilterId) => {
    setScope(filter);
  };

  const handleToggleCardExpand = (id: string) => {
    setExpandedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalAfterFilter = sortedSessions.length;

  return (
    <Flex vertical className={styles["archive-view"]}>
      <Flex align="center" gap={12} className={styles["app-archive-header"]}>
        <Flex align="center" justify="center" className={styles["app-archive-header__badge"]}>
          <Save size={ICON_SIZE.LARGE} className={styles["app-archive-header__icon"]} />
        </Flex>
        <Flex vertical className={styles["app-archive-header__content"]}>
          <Typography.Text className={styles["app-archive-header__title"]}>
            {t("归档会话")}
          </Typography.Text>
          <Typography.Text className={styles["app-archive-header__subtitle"]}>
            {t(
              "归档 = 把当前窗口所有标签页打包成一个「会话」快照，保存后会关闭这些标签页。需要时点击「恢复」即可在当前窗口里重新打开，适合整理浏览环境或临时腾出空间。",
            )}
          </Typography.Text>
        </Flex>
      </Flex>

      <div className={styles["archive-shell"]}>
        <ArchiveSidebar sessions={sessions} activeFilter={scope} onSelectFilter={setScope} />

        <Flex vertical gap={16} className={styles["archive-main"]}>
          <ArchiveStats
            sessions={sessions}
            activeFilter={scope === "earlier" ? "all" : scope}
            onSelectFilter={handleSelectStatsFilter}
          />

          <Flex align="center" gap={10} className={styles["archive-toolbar"]}>
            <Input.Search
              className={styles["archive-toolbar__search"]}
              placeholder={t("搜索归档会话...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              allowClear
            />

            <Select
              className={styles["archive-toolbar__sort"]}
              value={sortMode}
              onChange={(value: SortMode) => setSortMode(value)}
              suffixIcon={<ArrowDownUp size={ICON_SIZE.TINY} />}
              options={[
                { value: "newest", label: t("最近创建") },
                { value: "oldest", label: t("最早创建") },
                { value: "largest", label: t("标签最多") },
                { value: "name", label: t("按名称") },
              ]}
              popupMatchSelectWidth={false}
              size="middle"
            />

            <span className={styles["archive-toolbar__spacer"]} />

            {isSearching && (
              <Typography.Text className={styles["archive-search-result"]}>
                {t("找到 {count} / 共 {total} 个会话", {
                  count: totalAfterFilter,
                  total: sessions.length,
                })}
              </Typography.Text>
            )}

            <Flex align="center" gap={8} className={styles["archive-toolbar__primary-actions"]}>
              <BatchOperationsMenu
                selectedIds={selectedIds}
                totalCount={sessions.length}
                selectable={selectable}
                onToggleSelectMode={handleSelectModeChange}
                onBatchRestore={(ids) => {
                  for (const id of ids) handleRestore(id);
                }}
                onBatchDelete={async (ids) => {
                  for (const id of ids) await handleDelete(id);
                }}
                onMergeSessions={handleOpenMerge}
                onExportSessions={async (ids) => {
                  for (const id of ids) await handleShare(id);
                }}
                onClearAll={async () => {
                  for (const session of sessions) await handleDelete(session.id);
                }}
              />
              <Button
                type="primary"
                icon={<Plus size={ICON_SIZE.MEDIUM} />}
                loading={archivingCurrent}
                disabled={tabCount === 0}
                onClick={() => {
                  void handleArchiveCurrent();
                }}
                title={t("{count} 个标签页", { count: tabCount })}
              >
                {t("归档")}
              </Button>
            </Flex>
          </Flex>

          {loading ? (
            <Flex justify="center" className={styles["app-archive-loading"]}>
              <Flex
                vertical
                align="center"
                gap={12}
                className={styles["app-archive-loading__content"]}
              >
                <Spin />
                <Typography.Text className={styles["app-archive-loading__copy"]}>
                  {t("加载中...")}
                </Typography.Text>
              </Flex>
            </Flex>
          ) : totalAfterFilter === 0 ? (
            sessions.length === 0 ? (
              <FeatureEmptyState
                title={t("暂无归档会话")}
                description={t("点击归档按钮保存当前所有标签页")}
                icon={<Inbox size={ICON_SIZE.HERO} />}
                hints={[
                  t("一键归档当前窗口所有标签，释放浏览器内存"),
                  t("支持整组恢复或选择性恢复，不丢失任何进度"),
                  t("自动快照定时保存您的标签状态"),
                ]}
                actions={[
                  {
                    text: t("归档当前窗口"),
                    onClick: () => {
                      void handleArchiveCurrent();
                    },
                    type: "primary",
                  },
                ]}
              />
            ) : (
              <Empty description={t("暂无归档会话")} />
            )
          ) : (
            buckets.map((bucket) => (
              <Flex
                key={bucket.key}
                vertical
                gap={12}
                component="section"
                className={styles["archive-time-group"]}
              >
                {sortMode !== "largest" && sortMode !== "name" && (
                  <Flex
                    align="baseline"
                    gap={10}
                    component="header"
                    className={styles["archive-time-group__header"]}
                  >
                    <Typography.Text className={styles["archive-time-group__title"]}>
                      {t(bucket.labelKey)}
                    </Typography.Text>
                    <Typography.Text className={styles["archive-time-group__count"]}>
                      {bucket.sessions.length}
                    </Typography.Text>
                  </Flex>
                )}
                <div className={styles["archive-card-grid"]}>
                  {bucket.sessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      locale={locale}
                      highlighted={highlightId === session.id}
                      onRestore={handleRestore}
                      onDelete={(id) => {
                        void handleDelete(id);
                      }}
                      onStartRenaming={startRenaming}
                      onShare={(id) => {
                        void handleShare(id);
                      }}
                      onOpenSingle={(tab) => {
                        void handleOpenSingle(tab);
                      }}
                      selectable={selectable}
                      selected={selectedIds.has(session.id)}
                      onToggleSelect={toggleSelect}
                      highlightQuery={isSearching ? searchQuery : undefined}
                      matchedTabIndexes={matchedTabIndexes.get(session.id)}
                      expanded={expandedSessions.has(session.id)}
                      onToggleExpand={handleToggleCardExpand}
                    />
                  ))}
                </div>
              </Flex>
            ))
          )}
        </Flex>
      </div>

      {/* 合并 Modal */}
      <Modal
        open={mergeOpen}
        rootClassName={styles["app-archive-merge-modal"]}
        title={t("合并会话")}
        onCancel={() => setMergeOpen(false)}
        onOk={() => void handleConfirmMerge()}
        okText={t("合并")}
        cancelText={t("取消")}
        centered
      >
        <Typography.Text className={styles["app-archive-merge-copy"]}>
          {t("将合并 {count} 个会话为一个新会话，并按 URL 去重。原会话将被删除。", {
            count: selectedIds.size,
          })}
        </Typography.Text>
        <Input
          value={mergeName}
          onChange={(e) => setMergeName(e.target.value)}
          placeholder={t("新会话名")}
        />
      </Modal>

      {/* 恢复对话框 */}
      {restoringSession && (
        <EnhancedRestoreDialog
          open={restoreDialogOpen}
          sessionId={restoringSession.id}
          sessionName={restoringSession.name}
          tabCount={restoringSession.tabCount}
          onClose={() => {
            setRestoreDialogOpen(false);
            setRestoringSession(null);
          }}
          onRestoreComplete={(outcome) => void handleEnhancedRestoreComplete(outcome)}
        />
      )}

      {/* 重命名对话框 */}
      {renamingSession && (
        <EnhancedRenameDialog
          open={renamingDialogOpen}
          sessionId={renamingSession.id}
          currentName={renamingSession.name}
          tabCount={renamingSession.tabCount}
          tabUrls={renamingSession.tabs.map((tab) => tab.url)}
          onClose={() => {
            setRenamingDialogOpen(false);
            setRenamingSession(null);
          }}
          onRenameConfirm={async (id, newName) => {
            try {
              await useSessionsStore.getState().renameSession(id, newName);
              feedback.success(t("重命名成功"));
            } catch (err) {
              feedback.error(t("重命名"), err);
            }
          }}
        />
      )}
    </Flex>
  );
}
