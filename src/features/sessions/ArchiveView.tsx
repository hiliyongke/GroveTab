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

import { useState, useSyncExternalStore, useEffect, useMemo } from "react";
import { Plus, Save, Inbox, ArrowDownUp } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { Button, Spin, Input, Modal, Typography, Select, Empty } from "antd";
import { FeatureEmptyState } from "@/shared/ui/FeatureEmptyState";
import type { ArchivedSession } from "@/shared/types";
import {
  getArchivedSessions,
  deleteSession,
  renameSession,
  archiveAllTabs,
  mergeSessions,
  exportSingleSession,
} from "@/services";
import type { RestoreOutcome } from "@/services/archive";
import { createTab, getCurrentWindow } from "@/chrome";
import { useT } from "@/shared/i18n";
import { track } from "@/shared/utils/metrics";
import { useTabsStore, useUndoStore, useMetadataStore, useSettingsStore } from "@/store";
import { feedback } from "@/shared/ui/feedback";
import { appendHistoryEvent } from "@/repositories";
import { registerHistoryUndoHandler } from "@/services/history/undo-bus";
import { SessionCard } from "./components/SessionCard";
import { ArchiveStats, type ArchiveFilterId } from "./components/ArchiveStats";
import { ArchiveSidebar } from "./components/ArchiveSidebar";
import { BatchOperationsMenu } from "./components/BatchOperationsMenu";
import { EnhancedRestoreDialog } from "./components/EnhancedRestoreDialog";
import { EnhancedRenameDialog } from "./components/EnhancedRenameDialog";
import { APP_EVENTS } from "@/shared/config/storage-keys";
import { isSafeExternalUrl } from "@/shared/utils/url-safety";
import styles from "./styles/archive.module.less";

/* ---------- 简易外部 store 同步归档列表 ---------- */
let sessionsCache: ArchivedSession[] = [];
let sessionsInitialized = false;
let sessionsListeners: Array<() => void> = [];

function subscribeSessions(listener: () => void) {
  sessionsListeners.push(listener);
  return () => {
    sessionsListeners = sessionsListeners.filter((l) => l !== listener);
  };
}
function getSessionsSnapshot() {
  return sessionsCache;
}
function getSessionsInitialized() {
  return sessionsInitialized;
}
function notifySessionsListeners() {
  sessionsListeners.forEach((l) => l());
}
async function refreshSessions() {
  sessionsCache = await getArchivedSessions();
  sessionsInitialized = true;
  notifySessionsListeners();
}

void refreshSessions();

registerHistoryUndoHandler("archive_create", async (event) => {
  const sessionId = (event.undoContext as { sessionId?: string } | undefined)?.sessionId;
  if (sessionId === undefined || sessionId === "") return false;
  await deleteSession(sessionId);
  await refreshSessions();
  return true;
});

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
  const sessions = useSyncExternalStore(subscribeSessions, getSessionsSnapshot);
  const initialized = useSyncExternalStore(subscribeSessions, getSessionsInitialized);
  const loading = !initialized;
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
      feedback.info(t("archive.restoreCancelled", { restored: outcome.restored }));
    } else if (outcome.restored === total) {
      feedback.success(t("archive.restoredOk"));
    } else {
      feedback.warning(t("archive.restorePartial", { restored: outcome.restored, total }));
    }
    setRestoreDialogOpen(false);
    setRestoringSession(null);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSession(id);
      void track("archive_delete");
      await refreshSessions();
    } catch (err) {
      feedback.error(t("archive.deleteFailed"), err);
    }
  };

  const handleShare = async (id: string) => {
    const payload = await exportSingleSession(id);
    if (payload === null) {
      feedback.error(t("archive.shareFailed"));
      return;
    }
    try {
      const blob = new Blob([payload.content], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = payload.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      feedback.success(t("archive.shareOk"));
    } catch (err) {
      feedback.error(t("archive.shareFailed"), err);
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
      feedback.warning(t("archive.mergeNeedTwo"));
      return;
    }
    setSelectedIds(new Set(ids));
    setMergeName(t("archive.mergedDefaultName"));
    setMergeOpen(true);
  };

  const handleConfirmMerge = async () => {
    try {
      const newSession = await mergeSessions(Array.from(selectedIds), mergeName);
      void track("archive_merge", { count: selectedIds.size });
      await refreshSessions();
      setMergeOpen(false);
      cancelSelect();
      feedback.success(t("archive.mergedOk", { count: newSession.tabCount }));
      void useMetadataStore.getState().pushActivity({
        id: `merge-${newSession.id}`,
        type: "archive",
        ts: Date.now(),
        summary: t("archive.mergedActivity", { count: newSession.tabCount, name: newSession.name }),
      });
    } catch (err) {
      feedback.error(t("archive.mergeFailed"), err);
    }
  };

  const startRenaming = (session: ArchivedSession) => {
    setRenamingSession(session);
    setRenamingDialogOpen(true);
  };

  const handleOpenSingle = async (tab: { url: string }) => {
    if (!isSafeExternalUrl(tab.url)) {
      feedback.error(t("archive.restoreFailed"));
      return;
    }
    try {
      const currentWindow = await getCurrentWindow();
      await createTab({ url: tab.url, windowId: currentWindow?.id, active: true });
    } catch (err) {
      feedback.error(t("archive.restoreFailed"), err);
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
      const subNote = failCount > 0 ? t("archive.closeIncomplete", { count: failCount }) : "";
      void useUndoStore
        .getState()
        .addRecord(
          snapshots,
          t("archive.archivedRichToast", { count: archivedCount, name: session.name }),
          { archivedSessionId: session.id, subNote },
        );

      void useMetadataStore.getState().pushActivity({
        id: `archive-${session.id}`,
        type: "archive",
        ts: Date.now(),
        summary: t("activity.archived", { count: archivedCount, name: session.name }),
        primaryAction: {
          id: "view",
          label: t("activity.viewArchive"),
          kind: "open_archive",
          payload: session.id,
        },
      });
    } catch (err) {
      feedback.error(t("archive.archiveFailed"), err);
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
    <div className={styles["archive-view"]}>
      <div className={styles["app-archive-header"]}>
        <div className={styles["app-archive-header__badge"]}>
          <Save size={ICON_SIZE.LARGE} className={styles["app-archive-header__icon"]} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className={styles["app-archive-header__title"]}>{t("archive.title")}</div>
          <div className={styles["app-archive-header__subtitle"]}>{t("archive.description")}</div>
        </div>
      </div>

      <div className={styles["archive-shell"]}>
        <ArchiveSidebar sessions={sessions} activeFilter={scope} onSelectFilter={setScope} />

        <div className={styles["archive-main"]}>
          <ArchiveStats
            sessions={sessions}
            activeFilter={scope === "earlier" ? "all" : scope}
            onSelectFilter={handleSelectStatsFilter}
          />

          <div className={styles["archive-toolbar"]}>
            <Input.Search
              className={styles["archive-toolbar__search"]}
              placeholder={t("archive.searchPlaceholder")}
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
                { value: "newest", label: t("archive.toolbar.sortNewest") },
                { value: "oldest", label: t("archive.toolbar.sortOldest") },
                { value: "largest", label: t("archive.toolbar.sortLargest") },
                { value: "name", label: t("archive.toolbar.sortName") },
              ]}
              style={{ width: 140 }}
              size="middle"
            />

            <span className={styles["archive-toolbar__spacer"]} />

            {isSearching && (
              <span className={styles["archive-search-result"]}>
                {t("archive.searchResults", {
                  count: totalAfterFilter,
                  total: sessions.length,
                })}
              </span>
            )}

            <div className={styles["archive-toolbar__primary-actions"]}>
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
                title={t("header.tabCount", { count: tabCount })}
              >
                {t("header.archive")}
              </Button>
            </div>
          </div>

          {loading ? (
            <div className={styles["app-archive-loading"]}>
              <div className={styles["app-archive-loading__content"]}>
                <Spin />
                <span className={styles["app-archive-loading__copy"]}>{t("archive.loading")}</span>
              </div>
            </div>
          ) : totalAfterFilter === 0 ? (
            sessions.length === 0 ? (
              <FeatureEmptyState
                title={t("archive.empty")}
                description={t("archive.emptyHint")}
                icon={<Inbox size={ICON_SIZE.HERO} />}
                hints={[t("archive.emptyHint1"), t("archive.emptyHint2"), t("archive.emptyHint3")]}
                actions={[
                  {
                    text: t("archive.archiveCurrentWindow"),
                    onClick: () => {
                      void handleArchiveCurrent();
                    },
                    type: "primary",
                  },
                ]}
              />
            ) : (
              <Empty description={t("archive.empty")} />
            )
          ) : (
            buckets.map((bucket) => (
              <section key={bucket.key} className={styles["archive-time-group"]}>
                {sortMode !== "largest" && sortMode !== "name" && (
                  <header className={styles["archive-time-group__header"]}>
                    <span className={styles["archive-time-group__title"]}>
                      {t(bucket.labelKey)}
                    </span>
                    <span className={styles["archive-time-group__count"]}>
                      {bucket.sessions.length}
                    </span>
                  </header>
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
              </section>
            ))
          )}
        </div>
      </div>

      {/* 合并 Modal */}
      <Modal
        open={mergeOpen}
        rootClassName={styles["app-archive-merge-modal"]}
        title={t("archive.mergeTitle")}
        onCancel={() => setMergeOpen(false)}
        onOk={() => void handleConfirmMerge()}
        okText={t("archive.merge")}
        cancelText={t("archive.cancel")}
        centered
      >
        <Typography.Text className={styles["app-archive-merge-copy"]}>
          {t("archive.mergeDesc", { count: selectedIds.size })}
        </Typography.Text>
        <Input
          value={mergeName}
          onChange={(e) => setMergeName(e.target.value)}
          placeholder={t("archive.mergeNamePlaceholder")}
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
              await renameSession(id, newName);
              await refreshSessions();
              feedback.success(t("archive.renameOk"));
            } catch (err) {
              feedback.error(t("archive.rename"), err);
            }
          }}
        />
      )}
    </div>
  );
}
