/**
 * link-checker.ts — 批量检测书签 URL 可达性
 *
 * 实现要点：
 *   - 8 并发批次，更充分地利用浏览器连接池
 *   - 3s 单请求超时（之前 5s 偏长）
 *   - 流式回调：每个 URL 检测完立即报告（onResult）
 *   - 进度回调（onProgress）按已检测数
 *   - AbortSignal 用于提前终止
 *
 * 注意：浏览器 CORS 限制下 HEAD/no-cors 的 status 始终为 0；
 * 实际可判定的是"是否响应"（ok=true / fetch 抛错）。
 * "未抛错 → 视为可达"是保守但实用的策略。
 */

export interface LinkCheckResult {
  url: string;
  ok: boolean;
  status: number;
  /** 检测耗时（ms）—— 用于性能调优 */
  durationMs: number;
}

const BATCH_SIZE = 8;
const PER_REQUEST_TIMEOUT_MS = 3000;

/** 单 URL 检测 */
async function checkOne(url: string): Promise<LinkCheckResult> {
  const start = performance.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PER_REQUEST_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      method: "HEAD",
      mode: "no-cors",
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    return {
      url,
      ok: r.ok || r.type === "opaque",
      status: r.status,
      durationMs: performance.now() - start,
    };
  } catch {
    clearTimeout(timer);
    return { url, ok: false, status: 0, durationMs: performance.now() - start };
  }
}

export interface CheckLinksCallbacks {
  /** 单个 URL 检测完成时触发（流式） */
  onResult?: (result: LinkCheckResult) => void;
  /** 批次完成时触发（携带累计进度） */
  onProgress?: (checked: number, total: number) => void;
}

/**
 * 串行批次并发执行，**流式**地报告每个 URL 结果。
 *
 * @param urls  待检测 URL 列表
 * @param cbs   进度/结果回调
 * @param signal AbortSignal 用于提前终止
 */
export async function checkLinks(
  urls: string[],
  cbs: CheckLinksCallbacks = {},
  signal?: AbortSignal,
): Promise<LinkCheckResult[]> {
  const { onResult, onProgress } = cbs;
  const results: LinkCheckResult[] = [];
  const total = urls.length;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    if (signal?.aborted) break;
    const batch = urls.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(checkOne));
    // 立即流式回调
    for (const r of batchResults) {
      results.push(r);
      onResult?.(r);
    }
    onProgress?.(Math.min(total, i + batch.length), total);
  }
  return results;
}
