/**
 * useUnifiedSearchIndex（需求 3.1 / 3.2 / 3.4）
 *
 * 管理统一离线搜索索引 Worker 的生命周期：
 *   · 在 Worker 中增量构建覆盖标签、归档、书签、历史的统一索引
 *   · 暴露 searchUnified(query) 方法，返回跨数据源的搜索结果
 *   · 使用 scheduler.postTask 将构建任务降级为后台优先级
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { BuildPayload, SearchResult } from "@/shared/workers/unified-search.worker";
import type { ArchivedSession } from "@/shared/types";
import type { LiveTab } from "@/shared/types";

export type { SearchResult };

interface UseUnifiedSearchIndexOptions {
  /** 是否激活（搜索框打开时才构建） */
  active: boolean;
  /** 当前标签页列表 */
  tabs: LiveTab[];
  /** 归档会话列表 */
  archiveSessions: ArchivedSession[];
  /** 书签列表（可选） */
  bookmarks?: Array<{
    id: string;
    title: string;
    url: string;
    hostname: string;
    folderPath?: string;
  }>;
  /** 历史记录（可选） */
  historyEntries?: Array<{
    id: string;
    title: string;
    url: string;
    hostname: string;
    visitCount?: number;
    lastVisited?: number;
  }>;
}

export interface UnifiedSearchIndexState {
  /** 是否已就绪 */
  ready: boolean;
  /** 执行跨数据源搜索，返回 Promise<SearchResult[]> */
  searchUnified: (query: string) => Promise<SearchResult[]>;
}

export function useUnifiedSearchIndex(
  options: UseUnifiedSearchIndexOptions,
): UnifiedSearchIndexState {
  const { active, tabs, archiveSessions, bookmarks, historyEntries } = options;

  const workerRef = useRef<Worker | null>(null);
  const [ready, setReady] = useState(false);
  const pendingRef = useRef<Map<string, (results: SearchResult[]) => void>>(new Map());

  // ── 初始化 Worker ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!active) return;

    const worker = new Worker(
      new URL("@/shared/workers/unified-search.worker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = worker;

    worker.addEventListener("message", (event: MessageEvent) => {
      const msg = event.data as
        | { type: "ready"; indexId: string }
        | { type: "error"; message: string }
        | { type: "results"; requestId: string; results: SearchResult[] };

      if (msg.type === "ready") {
        setReady(true);
        return;
      }
      if (msg.type === "error") {
        console.warn("[UnifiedSearch] Worker error:", msg.message);
        return;
      }
      if (msg.type === "results") {
        const resolve = pendingRef.current.get(msg.requestId);
        if (resolve) {
          pendingRef.current.delete(msg.requestId);
          resolve(msg.results);
        }
      }
    });

    return () => {
      worker.terminate();
      workerRef.current = null;
      setReady(false);
      pendingRef.current.clear();
    };
  }, [active]);

  // ── 构建索引签名（内容变化时才重建，避免每次渲染都触发）──────────────────
  // 用 id+url 拼接字符串作为签名，能感知数量变化和内容变化（如 tab 标题/URL 更新）
  const tabsSignature = tabs.map((t) => `${t.id}:${t.url}`).join("\u0001");
  const archiveSignature = archiveSessions.map((s) => `${s.id}:${s.tabs.length}`).join("\u0001");
  const bookmarksSignature = bookmarks?.map((b) => b.id).join("\u0001") ?? "";
  const historySignature = historyEntries?.map((h) => h.id).join("\u0001") ?? "";

  // ── 构建索引（数据变化时重建）──────────────────────────────────────────────
  useEffect(() => {
    if (!active || !workerRef.current) return;

    const payload: BuildPayload = {
      tabs: tabs.map((t) => ({
        id: t.id,
        title: t.title,
        url: t.url,
        hostname: t.hostname,
      })),
      archiveSessions: archiveSessions.map((s) => ({
        id: s.id,
        name: s.name,
        tabs: s.tabs.map((tab) => ({
          url: tab.url,
          title: tab.title,
          hostname: tab.hostname,
        })),
      })),
      bookmarks,
      historyEntries,
    };

    setReady(false);
    workerRef.current.postMessage({ type: "build", payload });
  }, [
    active,
    tabsSignature,
    archiveSignature,
    bookmarksSignature,
    historySignature,
    // tabs/archiveSessions/bookmarks/historyEntries 本身不放入依赖，
    // 通过上方签名字符串感知变化，避免引用变化导致无意义重建

    tabs,

    archiveSessions,

    bookmarks,

    historyEntries,
  ]);

  // ── 搜索方法 ──────────────────────────────────────────────────────────────
  const searchUnified = useCallback(
    (query: string): Promise<SearchResult[]> => {
      if (!workerRef.current || !ready || query.trim() === "") {
        return Promise.resolve([]);
      }
      const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      return new Promise<SearchResult[]>((resolve) => {
        pendingRef.current.set(requestId, resolve);
        workerRef.current!.postMessage({ type: "search", query, requestId });
        // 超时保护：2s 后自动 resolve 空数组
        setTimeout(() => {
          if (pendingRef.current.has(requestId)) {
            pendingRef.current.delete(requestId);
            resolve([]);
          }
        }, 2000);
      });
    },
    [ready],
  );

  return { ready, searchUnified };
}
