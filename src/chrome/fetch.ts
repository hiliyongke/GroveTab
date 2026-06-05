/**
 * fetch 封装层：超时 + 可选重试 + no-cors 支持。
 *
 * 所有 fetch 调用必须通过此文件，禁止业务代码直接调用底层 fetch。
 */

const DEFAULT_FETCH_TIMEOUT = 10_000;

/** 带超时的 fetch */
async function fetchWithTimeout(
  input: RequestInfo,
  init?: RequestInit,
  timeoutMs = DEFAULT_FETCH_TIMEOUT,
): Promise<Response> {
  const controller = new AbortController();
  const signal = init?.signal;

  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  if (signal) {
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * GET 请求（带超时 + 可选指数退避重试）。
 */
export async function fetchGet(
  url: string,
  options?: RequestInit & { retries?: number },
): Promise<Response> {
  const { retries = 0, ...init } = options ?? {};
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
      }
      return await fetchWithTimeout(url, { method: "GET", ...init });
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        console.warn(`[fetch] GET ${url} attempt ${attempt + 1}/${retries + 1} failed, retrying...`);
      }
    }
  }
  throw lastErr;
}

/**
 * no-cors 模式 GET 请求（用于书签健康检查等场景）。
 */
export async function fetchNoCors(url: string, signal?: AbortSignal): Promise<Response> {
  return fetchWithTimeout(
    url,
    { method: "GET", mode: "no-cors", signal, redirect: "follow" },
    15_000,
  );
}
