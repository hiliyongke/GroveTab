/**
 * useSmartSuggestions —— 基于本地数据生成可操作的智能建议
 *
 * 建议类型：
 *   - storage_risk：chrome.storage 超 70% 时建议迁移到 OPFS
 *   - archive_suggestion：标签数 > 20 时建议归档
 *   - workspace_suggestion：访问域名 > 5 时建议建工作区
 *   - schedule_archive：近 7 天每日打开 > 15 时建议定时归档
 */
import { useMemo } from "react";
import type { StorageQuotaInfo } from "@/shared/utils/opfs-storage";

export type SuggestionLevel = "warning" | "info" | "success";

export interface SmartSuggestion {
  id: string;
  level: SuggestionLevel;
  titleKey: string;
  descKey: string;
  /** 可选的操作标签 key */
  actionKey?: string;
  /** 操作回调 */
  onAction?: () => void;
}

interface SuggestionInput {
  quota: StorageQuotaInfo | null;
  archiveTabCount: number;
  topDomainCount: number;
  dailyOpens: number[];
  onOpenArchive?: () => void;
  onOpenSettings?: () => void;
}

export function useSmartSuggestions({
  quota,
  archiveTabCount,
  topDomainCount,
  dailyOpens,
  onOpenArchive,
  onOpenSettings,
}: SuggestionInput): SmartSuggestion[] {
  return useMemo(() => {
    const suggestions: SmartSuggestion[] = [];

    // 1. chrome.storage 超 70% 风险
    if (quota && quota.chromeStorageRatio >= 0.7) {
      suggestions.push({
        id: "storage_risk",
        level: quota.chromeStorageRatio >= 0.9 ? "warning" : "info",
        titleKey: "insights.suggest.storageRisk.title",
        descKey: "insights.suggest.storageRisk.desc",
        actionKey: "insights.suggest.storageRisk.action",
        onAction: onOpenSettings,
      });
    }

    // 2. 归档 tab 数 > 20，建议固定常用会话
    if (archiveTabCount > 20) {
      suggestions.push({
        id: "archive_suggestion",
        level: "info",
        titleKey: "insights.suggest.archiveLarge.title",
        descKey: "insights.suggest.archiveLarge.desc",
        actionKey: "insights.suggest.archiveLarge.action",
        onAction: onOpenArchive,
      });
    }

    // 3. 访问域名 > 5，建议建工作区
    if (topDomainCount > 5) {
      suggestions.push({
        id: "workspace_suggestion",
        level: "info",
        titleKey: "insights.suggest.workspace.title",
        descKey: "insights.suggest.workspace.desc",
      });
    }

    // 4. 近 7 天平均每日打开 > 15，建议定时归档
    const avgDaily =
      dailyOpens.length > 0 ? dailyOpens.reduce((a, b) => a + b, 0) / dailyOpens.length : 0;
    if (avgDaily > 15) {
      suggestions.push({
        id: "schedule_archive",
        level: "info",
        titleKey: "insights.suggest.scheduleArchive.title",
        descKey: "insights.suggest.scheduleArchive.desc",
        actionKey: "insights.suggest.scheduleArchive.action",
        onAction: onOpenSettings,
      });
    }

    // 5. 一切正常
    if (suggestions.length === 0) {
      suggestions.push({
        id: "all_good",
        level: "success",
        titleKey: "insights.suggest.allGood.title",
        descKey: "insights.suggest.allGood.desc",
      });
    }

    return suggestions;
  }, [quota, archiveTabCount, topDomainCount, dailyOpens, onOpenArchive, onOpenSettings]);
}
