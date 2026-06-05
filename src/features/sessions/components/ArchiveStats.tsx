/**
 * ArchiveStats — 归档页顶部 KPI 概览
 *
 * 4 个卡片横向铺开：总会话 / 总标签 / 本月新增 / 自动快照
 * 卡片可点击：触发对应筛选条件，与左导航联动。
 * 视觉与 DevToolsView 主体保持一致：浅色卡 + 主色图标徽章。
 */

import { useMemo } from "react";
import { Archive, Layers, Calendar, Sparkles } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import type { ArchivedSession } from "@/shared/types";
import { useT } from "@/shared/i18n";
import styles from "../styles/archive.module.less";

export type ArchiveFilterId = "all" | "today" | "week" | "month" | "auto";

interface ArchiveStatsProps {
  sessions: ArchivedSession[];
  activeFilter: ArchiveFilterId;
  onSelectFilter: (filter: ArchiveFilterId) => void;
}

interface StatCardSpec {
  id: ArchiveFilterId;
  labelKey: string;
  Icon: typeof Archive;
  valueKey: "total" | "tabs" | "month" | "auto";
  tone: "primary" | "info" | "success" | "warning";
}

const CARDS: StatCardSpec[] = [
  {
    id: "all",
    labelKey: "archive.stats.totalSessions",
    Icon: Archive,
    valueKey: "total",
    tone: "primary",
  },
  { id: "all", labelKey: "archive.stats.totalTabs", Icon: Layers, valueKey: "tabs", tone: "info" },
  {
    id: "month",
    labelKey: "archive.stats.thisMonth",
    Icon: Calendar,
    valueKey: "month",
    tone: "success",
  },
  {
    id: "auto",
    labelKey: "archive.stats.autoSnapshots",
    Icon: Sparkles,
    valueKey: "auto",
    tone: "warning",
  },
];

export function ArchiveStats({ sessions, activeFilter, onSelectFilter }: ArchiveStatsProps) {
  const { t } = useT();

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    let totalTabs = 0;
    let monthCount = 0;
    let autoCount = 0;
    for (const session of sessions) {
      totalTabs += session.tabCount;
      if (session.createdAt >= monthStart) monthCount += 1;
      if (session.source === "auto" || session.hidden === true) autoCount += 1;
    }
    return {
      total: sessions.length,
      tabs: totalTabs,
      month: monthCount,
      auto: autoCount,
    };
  }, [sessions]);

  return (
    <div className={styles["archive-stats"]}>
      {CARDS.map((card, idx) => {
        const value = stats[card.valueKey];
        const isActive = activeFilter === card.id && card.id !== "all";
        return (
          <div
            key={`${card.id}-${idx}`}
            role="button"
            tabIndex={0}
            className={`${styles["archive-stat-card"]} ${styles[`is-${card.tone}`]}${isActive ? " " + styles["is-active"] : ""}`}
            onClick={() => onSelectFilter(card.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onSelectFilter(card.id);
            }}
          >
            <span className={styles["archive-stat-card__icon"]}>
              <card.Icon size={ICON_SIZE.LARGE} />
            </span>
            <span className={styles["archive-stat-card__body"]}>
              <span className={styles["archive-stat-card__value"]}>{value}</span>
              <span className={styles["archive-stat-card__label"]}>{t(card.labelKey)}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
