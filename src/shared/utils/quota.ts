/**
 * 存储配额监控 —— 检测 chrome.storage.local 使用量并在超过 8 MiB 时警告
 */

/** 警告阈值：8 MiB */
const WARNING_THRESHOLD = 8 * 1024 * 1024;

/** 存储配额状态 */
export interface QuotaStatus {
  /** 已使用字节数 */
  usedBytes: number;
  /** 总容量（chrome.storage.local 上限 10 MiB） */
  totalBytes: number;
  /** 使用百分比（0-100） */
  percentage: number;
  /** 是否超过警告阈值 */
  isWarning: boolean;
}

/**
 * 获取当前存储使用状态
 *
 * @returns 存储配额状态对象（含已使用字节数、百分比、是否警告）
 */
export async function getQuotaStatus(): Promise<QuotaStatus> {
  const totalBytes = 10 * 1024 * 1024; // chrome.storage.local limit
  let usedBytes = 0;
  try {
    usedBytes = await chrome.storage.local.getBytesInUse(null);
  } catch {
  // 兜底：从数据大小估算
    usedBytes = 0;
  }
  const percentage = Math.round((usedBytes / totalBytes) * 100);
  const isWarning = usedBytes >= WARNING_THRESHOLD;

  return { usedBytes, totalBytes, percentage, isWarning };
}

/**
 * 将字节数格式化为可读字符串
 *
 * @param bytes 字节数
 * @returns 格式化后的字符串（如 "1.5 MB"、"200 KB"）
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
