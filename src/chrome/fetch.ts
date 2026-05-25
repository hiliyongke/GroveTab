/**
 * fetch 封装层
 *
 * 所有对 fetch 的调用必须通过此文件，
 * 禁止在 services/repositories/chrome 层以外的业务代码中直接调用 fetch。
 */

/**
 * 发起 GET 请求并返回 Response
 * @param url     请求 URL
 * @param options 可选的 RequestInit 配置
 */
export async function fetchGet(url: string, options?: RequestInit): Promise<Response> {
  return fetch(url, { method: "GET", ...options });
}

/**
 * 发起 no-cors 模式的 GET 请求（用于书签健康检查等场景）
 * @param url       请求 URL
 * @param signal    AbortSignal，用于超时控制
 */
export async function fetchNoCors(url: string, signal?: AbortSignal): Promise<Response> {
  return fetch(url, {
    method: "GET",
    mode: "no-cors",
    signal,
    redirect: "follow",
  });
}
