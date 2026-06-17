import { useEffect, useState, useRef, useCallback } from "react";
import { useSettingsStore, useTabsStore, useUndoStore, useMetadataStore } from "@/store";
import { initArchiveStorage } from "@/services/archive";
import { hasCompletedOnboarding, initMetaIfNeeded } from "@/repositories/storage-repo";
import { storageGet, storageSet, storageRemove } from "@/chrome";
import { STORAGE_KEYS } from "@/shared/config/storage-keys";
import { useT } from "@/shared/i18n";
import { BRAND } from "@/shared/config/brand";
import { recordMetric, recordFcpOnce, recordFpsSampleOnce } from "@/shared/utils/metrics";
import { isFeatureEnabled, FEATURE_FLAGS } from "@/shared/config/feature-flags";
import { registerHistoryUndoHandler } from "@/services/history/undo-bus";
import { LEGACY_DEFAULT_VIEW_MIGRATION } from "@/store/settings-slice";
import { getArchivedSessions, saveSessions } from "@/services/archive";
import type { ArchivedSession, TrashedItem } from "@/shared/types";

/**
 * 全局只注册一次的「tab_tagged 撤销 handler」标记。
 *
 * 为什么放在模块作用域：
 *   - useAppInitialization 在 React StrictMode 下会执行两次，必须避免重复注册导致回调被覆盖。
 *   - 各 type 的 undo handler 是「单例语义」：业务无关的 UI 模块（HistoryView）通过 type 索引调用。
 */
let tagUndoRegistered = false;

/** 备份键前缀，用于迁移前备份旧数据。 */
const BACKUP_KEY_PREFIX = "BACKUP_v1_";

/**
 * v1.4 数据迁移：将旧版 settings（schemaVersion 缺失或 <2）迁移到 v2 格式。
 *
 * 迁移步骤：
 *   1. 备份当前 settings 到 chrome.storage.local
 *   2. 映射旧版 defaultView → tabs + tabsSubView/tabsLayout
 *   3. 迁移 trash_items[] → archived_sessions（source='trash'）
 *   4. 设置 schemaVersion = 2 并持久化
 *
 * 任何步骤失败时从备份恢复，保持 schemaVersion 不变。
 */
async function runSettingsMigration(): Promise<void> {
  const store = useSettingsStore.getState();
  const settings = store.settings;

  // 已是最新版本，无需迁移
  if ((settings.schemaVersion ?? 0) >= 2) return;

  const backupKey = `${BACKUP_KEY_PREFIX}${Date.now()}`;
  let migrationApplied = false;

  try {
    // 1. 备份当前 settings
    await storageSet(backupKey, settings);

    // 2. 旧版视图映射
    const updates: Partial<typeof settings> = {};
    const legacy = LEGACY_DEFAULT_VIEW_MIGRATION[settings.defaultView];
    if (legacy) {
      updates.defaultView = legacy.defaultView as typeof settings.defaultView;
      if (legacy.tabsSubView) {
        updates.tabsSubView = legacy.tabsSubView as typeof settings.tabsSubView;
      }
      if (legacy.tabsLayout) {
        updates.tabsLayout = legacy.tabsLayout as typeof settings.tabsLayout;
      }
    }

    // 3. trash_items → archived_sessions 迁移
    await migrateTrashToArchive();

    // 4. 设置 schemaVersion = 2
    updates.schemaVersion = 2;

    // 5. 持久化
    await store.updateSettings(updates as Parameters<typeof store.updateSettings>[0]);
    migrationApplied = true;

    if (import.meta.env.DEV) {
      console.info(`[MIGRATION] settings v1→v2 completed. backup: ${backupKey}`);
    }
  } catch (err) {
    console.warn("[MIGRATION] settings migration failed, restoring from backup:", err);

    // 恢复备份
    try {
      const backup = await storageGet<typeof settings>(backupKey);
      if (backup) {
        await store.updateSettings(backup as Parameters<typeof store.updateSettings>[0]);
      }
    } catch (restoreErr) {
      console.error("[MIGRATION] backup restore also failed:", restoreErr);
    }

    // 清理备份键
  } finally {
    // 成功迁移或恢复后删除备份键
    if (migrationApplied) {
      try {
        await storageRemove(backupKey);
      } catch {
        // 清理失败不影响主流程
      }
    }
  }
}

/**
 * 将 chrome.storage.local 中的 trash_items 迁移到 archived_sessions。
 * 每条 TrashedItem 转换为一个 ArchivedSession（source='trash'），
 * 合并到现有 archived_sessions 列表头部，最后删除 trash_items。
 */
async function migrateTrashToArchive(): Promise<void> {
  try {
    const trashItems = await storageGet<TrashedItem[]>(STORAGE_KEYS.trash);
    if (!trashItems || trashItems.length === 0) return;

    // 读取现有归档会话
    const existingSessions = await getArchivedSessions();

    // 将 TrashedItem[] 转换为 ArchivedSession[]
    const trashSessions: ArchivedSession[] = trashItems.map((item) => ({
      id: `trash_${item.id}`,
      name: item.name,
      createdAt: item.trashedAt,
      tabs: item.tabs.map((t) => ({
        url: t.url,
        title: t.title,
        favIconUrl: t.favIconUrl ?? "",
        hostname: t.hostname,
        pinned: t.pinned,
        groupId: t.groupId,
        index: undefined,
      })),
      tabCount: item.tabs.length,
      source: "trash" as const,
    }));

    // 合并：trash 会话放到头部
    const merged = [...trashSessions, ...existingSessions];
    await saveSessions(merged);

    // 删除旧 trash_items
    await storageRemove(STORAGE_KEYS.trash);

    if (import.meta.env.DEV) {
      console.info(
        `[MIGRATION] trash: ${trashItems.length} items → ${trashSessions.length} archived sessions`,
      );
    }
  } catch (err) {
    console.warn("[MIGRATION] trash migration failed:", err);
    throw err;
  }
}

/**
 * useAppInitialization —— 应用启动初始化逻辑
 *
 * 将 AppContent 中的异步初始化、hash 信号监听、滚动吸附搜索等
 * 副作用集中封装为一个 Hook，降低 AppContent 组件的复杂度。
 *
 * 返回：
 *   - checked: boolean —— 初始化是否完成
 *   - initError: string | null —— 初始化错误消息
 *   - showOnboarding: boolean —— 是否显示新手引导
 *   - searchFromHash: boolean —— URL hash 是否触发了搜索
 *   - compactSearchVisible: boolean —— Hero 搜索框是否滚出视野（吸附搜索是否可见）
 *   - heroSearchRef: RefObject<HTMLDivElement | null> —— Hero 搜索框的 DOM 引用
 *   - retry: () => void —— 重置错误状态（调用方需配合递增 initRunId 触发重试）
 *   - dismissOnboarding: () => void —— 关闭新手引导
 */
export function useAppInitialization(initRunId: number) {
  const { t } = useT();
  const mountedRef = useRef(true);
  const heroSearchRef = useRef<HTMLDivElement>(null);
  const [checked, setChecked] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [compactSearchVisible, setCompactSearchVisible] = useState(false);

  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const loadAllTabs = useTabsStore((s) => s.loadAllTabs);
  const loadUndoRecords = useUndoStore((s) => s.loadRecords);
  const loadMetadata = useMetadataStore((s) => s.loadMetadata);

  // Render-phase ref 赋值 (React 允许 render 中更新 ref)，避免额外 useEffect 开销
  const loadSettingsRef = useRef(loadSettings);
  const loadAllTabsRef = useRef(loadAllTabs);
  const loadUndoRecordsRef = useRef(loadUndoRecords);
  const loadMetadataRef = useRef(loadMetadata);
  const tRef = useRef(t);

  useEffect(() => {
    loadSettingsRef.current = loadSettings;
    loadAllTabsRef.current = loadAllTabs;
    loadUndoRecordsRef.current = loadUndoRecords;
    loadMetadataRef.current = loadMetadata;
    tRef.current = t;
  }, [loadSettings, loadAllTabs, loadUndoRecords, loadMetadata, t]);

  /**
   * 异步初始化：并行加载设置、标签页、撤销记录、元数据、新手引导状态
   */
  useEffect(() => {
    let cancelled = false;
    mountedRef.current = true;

    void (async () => {
      try {
        // P0: initMetaIfNeeded 与 loadSettings 并行（无数据依赖）
        await Promise.all([initMetaIfNeeded(), loadSettingsRef.current()]);

        // ── v1.4 数据迁移：settings schema v1 → v2 ──
        await runSettingsMigration();

        const [archiveInitResult, tabsResult, undoResult, metadataResult] =
          await Promise.allSettled([
            initArchiveStorage(),
            loadAllTabsRef.current(),
            loadUndoRecordsRef.current(),
            loadMetadataRef.current(),
          ]);

        // 注册 tab_tagged 撤销 handler（仅首次）。
        // 注：archive_create 的 handler 在 ArchiveView 模块加载时自行注册，那里能直接拿到 deleteSession + refreshSessions
        if (!tagUndoRegistered) {
          tagUndoRegistered = true;
          registerHistoryUndoHandler("tab_tagged", async (event) => {
            const ctx = event.undoContext as { url?: string; tag?: string } | undefined;
            if (ctx?.url === undefined || ctx.tag === undefined) return false;
            await useMetadataStore.getState().removeTag(ctx.url, ctx.tag);
            return true;
          });
        }

        if (archiveInitResult.status !== "fulfilled") {
          console.warn(`${BRAND.logTag} initArchiveStorage failed`, archiveInitResult.reason);
        }
        if (tabsResult.status === "rejected") {
          console.warn(`${BRAND.logTag} loadAllTabs failed`, tabsResult.reason);
          if (!cancelled) {
            setInitError(tRef.current("标签页加载失败，请刷新页面重试"));
          }
        }
        if (undoResult.status === "rejected") {
          console.warn(`${BRAND.logTag} loadUndoRecords failed`, undoResult.reason);
        }
        if (metadataResult.status === "rejected") {
          console.warn(`${BRAND.logTag} loadMetadata failed`, metadataResult.reason);
        }
        if (!cancelled) {
          const newFlow = await isFeatureEnabled(FEATURE_FLAGS.NEW_ONBOARDING_FLOW);
          if (newFlow) {
            try {
              const done = await hasCompletedOnboarding();
              setShowOnboarding(!done);
            } catch (onboardingErr) {
              console.warn(`${BRAND.logTag} hasCompletedOnboarding failed`, onboardingErr);
              setShowOnboarding(true);
            }
          }
        }
      } catch (err) {
        console.warn(`${BRAND.logTag} app initialization failed`, err);
        if (!cancelled) {
          setInitError(tRef.current("标签页加载失败，请刷新页面重试"));
        }
      } finally {
        if (!cancelled) {
          setChecked(true);
        }
        void recordMetric("newtabOpens");
        recordFcpOnce();
        recordFpsSampleOnce();
      }
    })();

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [initRunId]);

  /** 滚动吸附搜索：IntersectionObserver 监听 Hero 搜索框是否离开视野 */
  useEffect(() => {
    if (!checked) return;
    const node = heroSearchRef.current;
    if (node === null || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        setCompactSearchVisible(!entry.isIntersecting);
      },
      { rootMargin: "-64px 0px 0px 0px", threshold: 0 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [checked]);

  const retry = useCallback(() => {
    setInitError(null);
    setChecked(false);
  }, []);

  const dismissOnboarding = useCallback(() => setShowOnboarding(false), []);

  return {
    checked,
    initError,
    showOnboarding,
    compactSearchVisible,
    heroSearchRef,
    retry,
    dismissOnboarding,
  };
}
