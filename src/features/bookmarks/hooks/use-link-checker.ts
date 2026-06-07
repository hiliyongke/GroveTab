/**
 * useLinkChecker — 失效链接检测 Hook（v2 流式版）
 *
 * 改进：
 *   - 边检测边回报（partialResults 持续增长）
 *   - 暴露 total / checked 用于实时进度
 *   - 暴露 checked / failed 计数（O(1) 读取）
 *   - 支持 cancel（彻底终止）和 reset
 *
 * UI 友好：
 *   - `partialResults` 按检测顺序追加，前端可只渲染最近 N 条做实时预览
 *   - `broken` = partialResults 中 ok=false 的子集
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { checkLinks, type LinkCheckResult } from "../utils/link-checker";

export interface BrokenLinkInfo {
  url: string;
  title: string;
  status: number;
  bookmarkId: string;
  ok: boolean;
  durationMs: number;
}

export interface UseLinkCheckerResult {
  running: boolean;
  total: number;
  checked: number;
  /** 已检测的完整列表（按检测顺序）—— 用于实时预览 */
  partialResults: BrokenLinkInfo[];
  /** 失效项子集（!ok） */
  broken: BrokenLinkInfo[];
  /** 最近一次检测的总耗时（ms） */
  totalDurationMs: number;
  /** 开始检测 */
  run: (items: Array<{ id: string; title: string; url: string }>) => Promise<void>;
  /** 取消当前检测 */
  cancel: () => void;
  /** 清空状态 */
  reset: () => void;
}

function toBroken(
  result: LinkCheckResult,
  meta: { id: string; title: string } | undefined,
): BrokenLinkInfo | null {
  if (meta === undefined) return null;
  return {
    url: result.url,
    title: meta.title,
    status: result.status,
    bookmarkId: meta.id,
    ok: result.ok,
    durationMs: result.durationMs,
  };
}

export function useLinkChecker(): UseLinkCheckerResult {
  const [running, setRunning] = useState(false);
  const [total, setTotal] = useState(0);
  const [checked, setChecked] = useState(0);
  const [partialResults, setPartialResults] = useState<BrokenLinkInfo[]>([]);
  const [totalDurationMs, setTotalDurationMs] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setPartialResults([]);
    setChecked(0);
    setTotal(0);
    setTotalDurationMs(0);
    setRunning(false);
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const run = useCallback(
    async (items: Array<{ id: string; title: string; url: string }>) => {
      // 中止上一次未完成的任务
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const startedAt = performance.now();

      setPartialResults([]);
      setChecked(0);
      setTotal(items.length);
      setTotalDurationMs(0);
      setRunning(true);

      // 预构建 meta map（O(1) 查表）
      const metaMap = new Map<string, { id: string; title: string }>();
      for (const it of items) metaMap.set(it.url, { id: it.id, title: it.title });

      await checkLinks(
        items.map((i) => i.url),
        {
          onResult: (r) => {
            if (ctrl.signal.aborted) return;
            const meta = metaMap.get(r.url);
            const info = toBroken(r, meta);
            if (info === null) return;
            setPartialResults((prev) => [...prev, info]);
          },
          onProgress: (c) => {
            if (ctrl.signal.aborted) return;
            setChecked(c);
          },
        },
        ctrl.signal,
      );

      // 收尾：无论是否被 cancel，都刷新一次"已完成耗时"
      setRunning(false);
      setTotalDurationMs(performance.now() - startedAt);
    },
    [],
  );

  // 派生 broken —— useMemo 缓存，仅在 partialResults 变化时重算
  const broken = useMemo(
    () => partialResults.filter((r) => !r.ok),
    [partialResults],
  );

  return { running, total, checked, partialResults, broken, totalDurationMs, run, cancel, reset };
}
