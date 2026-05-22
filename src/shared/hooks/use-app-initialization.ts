import { useEffect, useState, useRef, useCallback } from 'react';
import { useSettingsStore, useTabsStore, useUndoStore, useMetadataStore } from '@/store';
import { initArchiveStorage } from '@/services/archive';
import { hasCompletedOnboarding } from '@/repositories/storage-repo';
import { useT } from '@/shared/i18n';
import { BRAND } from '@/shared/config/brand';
import { recordMetric, recordFcpOnce, recordFpsSampleOnce } from '@/shared/utils/metrics';

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
 *   - retry: () => void —— 重试初始化（重置错误状态并递增 initRunId）
 */
export function useAppInitialization(initRunId: number) {
  const { t } = useT();
  const mountedRef = useRef(true);
  const heroSearchRef = useRef<HTMLDivElement>(null);
  const [checked, setChecked] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [searchFromHash, setSearchFromHash] = useState(false);
  const [compactSearchVisible, setCompactSearchVisible] = useState(false);

  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const loadAllTabs = useTabsStore((s) => s.loadAllTabs);
  const loadUndoRecords = useUndoStore((s) => s.loadRecords);
  const loadMetadata = useMetadataStore((s) => s.loadMetadata);

  // 使用 ref 保存函数引用，避免 useEffect 依赖不稳定的 store 函数导致无限循环
  const loadSettingsRef = useRef(loadSettings);
  const loadAllTabsRef = useRef(loadAllTabs);
  const loadUndoRecordsRef = useRef(loadUndoRecords);
  const loadMetadataRef = useRef(loadMetadata);
  loadSettingsRef.current = loadSettings;
  loadAllTabsRef.current = loadAllTabs;
  loadUndoRecordsRef.current = loadUndoRecords;
  loadMetadataRef.current = loadMetadata;

  /** 全局快捷键通过 URL hash 传信号：#search → 自动聚焦搜索框 */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (hash === '#search') {
      setSearchFromHash(true);
    }
  }, []);

  useEffect(() => {
    if (searchFromHash && typeof window !== 'undefined' && window.location.hash === '#search') {
      history.replaceState(null, '', window.location.pathname);
    }
  }, [searchFromHash]);

  /**
   * 异步初始化：并行加载设置、标签页、撤销记录、元数据、新手引导状态
   */
  useEffect(() => {
    let cancelled = false;
    mountedRef.current = true;

    void (async () => {
      try {
        await loadSettingsRef.current();

        const [archiveInitResult, tabsResult, undoResult, metadataResult, onboardingResult] = await Promise.allSettled([
          initArchiveStorage(),
          loadAllTabsRef.current(),
          loadUndoRecordsRef.current(),
          loadMetadataRef.current(),
          hasCompletedOnboarding(),
        ]);

        if (archiveInitResult.status !== 'fulfilled') {
          console.warn(`${BRAND.logTag} initArchiveStorage failed`, archiveInitResult.reason);
        }
        if (tabsResult.status === 'rejected') {
          console.warn(`${BRAND.logTag} loadAllTabs failed`, tabsResult.reason);
          if (!cancelled) {
            setInitError(t('tabs.loadFailed'));
          }
        }
        if (undoResult.status === 'rejected') {
          console.warn(`${BRAND.logTag} loadUndoRecords failed`, undoResult.reason);
        }
        if (metadataResult.status === 'rejected') {
          console.warn(`${BRAND.logTag} loadMetadata failed`, metadataResult.reason);
        }
        if (!cancelled) {
          if (onboardingResult.status === 'fulfilled') {
            setShowOnboarding(!onboardingResult.value);
          } else {
            console.warn(`${BRAND.logTag} hasCompletedOnboarding failed`, onboardingResult.reason);
            setShowOnboarding(true);
          }
        }
      } catch (err) {
        console.warn(`${BRAND.logTag} app initialization failed`, err);
        if (!cancelled) {
          setInitError(t('tabs.loadFailed'));
        }
      } finally {
        if (!cancelled) {
          setChecked(true);
        }
        void recordMetric('newtabOpens');
        // v1.0 封板：首屏性能采样
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
    if (node === null || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setCompactSearchVisible(!entry.isIntersecting);
      },
      { rootMargin: '-64px 0px 0px 0px', threshold: 0 },
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
    searchFromHash,
    compactSearchVisible,
    heroSearchRef,
    mountedRef,
    retry,
    dismissOnboarding,
  };
}
