/**
 * Chrome API 统一调用封装：超时保护 + 错误归一化 + lastError 检查。
 */

import { BRAND } from "@/shared/config/brand";

export const CHROME_LOG_TAG = `${BRAND.logTag}/chrome`;

/** Chrome API 默认超时（ms） */
export const DEFAULT_TIMEOUT = 5000;

/**
 * 将 Chrome API 抛出的任意值归一化为 Error 实例。
 */
export function normalizeError(err: unknown, label: string): Error {
  if (err instanceof Error) {
    err.message = `${CHROME_LOG_TAG} ${label}: ${err.message}`;
    return err;
  }
  const msg =
    typeof err === "string"
      ? err
      : ((err as { message?: string })?.message ?? JSON.stringify(err));
  return new Error(`${CHROME_LOG_TAG} ${label}: ${msg}`);
}

/**
 * 为 Promise 添加超时保护。
 * promise resolve 后还会主动检查 chrome.runtime.lastError 作为兜底。
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${CHROME_LOG_TAG} ${label} timeout after ${ms}ms`));
    }, ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        const lastErr = chrome.runtime.lastError;
        if (lastErr) {
          reject(normalizeError(lastErr, label));
          return;
        }
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(normalizeError(err, label));
      },
    );
  });
}

/** 组合超时 + 错误归一化 + lastError 检查的调用入口。 */
export function safeCall<T>(
  label: string,
  fn: () => Promise<T>,
  timeout = DEFAULT_TIMEOUT,
): Promise<T> {
  try {
    return withTimeout(fn(), timeout, label);
  } catch (err) {
    return Promise.reject(normalizeError(err, label));
  }
}
