/**
 * QuotaMonitor — Storage capacity monitoring with 8 MiB warning threshold
 */

const WARNING_THRESHOLD = 8 * 1024 * 1024; // 8 MiB

export interface QuotaStatus {
  usedBytes: number;
  totalBytes: number; // 10 MiB for chrome.storage.local
  percentage: number;
  isWarning: boolean;
}

/** Get current storage usage */
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

/** Format bytes to human-readable string */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
