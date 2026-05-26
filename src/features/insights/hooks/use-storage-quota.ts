/**
 * useStorageQuota —— 获取 chrome.storage.local + OPFS 存储占用信息
 */
import { useEffect, useState } from "react";
import { getStorageQuotaInfo, type StorageQuotaInfo } from "@/shared/utils/opfs-storage";

export interface StorageQuotaState {
  loading: boolean;
  info: StorageQuotaInfo | null;
}

export function useStorageQuota(open: boolean): StorageQuotaState {
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<StorageQuotaInfo | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    void getStorageQuotaInfo()
      .then((result) => {
        if (!cancelled) setInfo(result);
      })
      .catch(() => {
        // 静默忽略
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  return { loading, info };
}
