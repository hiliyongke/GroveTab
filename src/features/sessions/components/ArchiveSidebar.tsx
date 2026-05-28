/**
 * ArchiveSidebar — 归档页左侧导航
 *
 * 提供时间段筛选（全部/今天/本周/本月/更早）+ 自动快照分区。
 * 与 DeveloperToolsPage 的 sidebar 风格对齐。
 */

import { useMemo } from "react";
import { Inbox, Sun, CalendarDays, CalendarRange, Clock, Sparkles } from "lucide-react";
import { Button } from "antd";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import type { ArchivedSession } from "@/shared/types";
import { useT } from "@/shared/i18n";
import styles from "../styles/archive.module.less";
import type { ArchiveFilterId } from "./ArchiveStats";

interface ArchiveSidebarProps {
  sessions: ArchivedSession[];
  activeFilter: ArchiveFilterId | "earlier";
  onSelectFilter: (filter: ArchiveFilterId | "earlier") => void;
}

interface FilterSpec {
  id: ArchiveFilterId | "earlier";
  labelKey: string;
  Icon: typeof Inbox;
}

const FILTERS: FilterSpec[] = [
  { id: "all", labelKey: "archive.filter.all", Icon: Inbox },
  { id: "today", labelKey: "archive.filter.today", Icon: Sun },
  { id: "week", labelKey: "archive.filter.thisWeek", Icon: CalendarDays },
  { id: "month", labelKey: "archive.filter.thisMonth", Icon: CalendarRange },
  { id: "earlier", labelKey: "archive.filter.earlier", Icon: Clock },
];

export function ArchiveSidebar({ sessions, activeFilter, onSelectFilter }: ArchiveSidebarProps) {
  const { t } = useT();

  /** 计算每个分类下的会话数量 */
  const counts = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = startOfToday - 6 * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const result: Record<ArchiveFilterId | "earlier", number> = {
      all: 0,
      today: 0,
      week: 0,
      month: 0,
      earlier: 0,
      auto: 0,
    };
    for (const session of sessions) {
      const isAuto = session.source === "auto" || session.hidden === true;
      if (isAuto) {
        result.auto += 1;
        continue;
      }
      result.all += 1;
      if (session.createdAt >= startOfToday) result.today += 1;
      if (session.createdAt >= startOfWeek) result.week += 1;
      if (session.createdAt >= startOfMonth) result.month += 1;
      if (session.createdAt < startOfMonth) result.earlier += 1;
    }
    return result;
  }, [sessions]);

  return (
    <aside className={styles["archive-sidebar"]}>
      <div className={styles["archive-sidebar__group"]}>
        <div className={styles["archive-sidebar__group-title"]}>{t("按时间")}</div>
        <div className={styles["archive-sidebar__list"]}>
          {FILTERS.map((filter) => {
            const isActive = activeFilter === filter.id;
            return (
              <Button
                key={filter.id}
                type="text"
                className={`${styles["archive-sidebar__item"]}${isActive ? " " + styles["is-active"] : ""}`}
                onClick={() => onSelectFilter(filter.id)}
              >
                <span className={styles["archive-sidebar__item-icon"]}>
                  <filter.Icon size={ICON_SIZE.MEDIUM} />
                </span>
                <span className={styles["archive-sidebar__item-label"]}>{t(filter.labelKey)}</span>
                <span className={styles["archive-sidebar__item-count"]}>{counts[filter.id]}</span>
              </Button>
            );
          })}
        </div>
      </div>

      <div className={styles["archive-sidebar__group"]}>
        <div className={styles["archive-sidebar__group-title"]}>{t("专项")}</div>
        <div className={styles["archive-sidebar__list"]}>
          <Button
            type="text"
            className={`${styles["archive-sidebar__item"]}${activeFilter === "auto" ? " " + styles["is-active"] : ""}`}
            onClick={() => onSelectFilter("auto")}
          >
            <span className={styles["archive-sidebar__item-icon"]}>
              <Sparkles size={ICON_SIZE.MEDIUM} />
            </span>
            <span className={styles["archive-sidebar__item-label"]}>{t("自动快照")}</span>
            <span className={styles["archive-sidebar__item-count"]}>{counts.auto}</span>
          </Button>
        </div>
      </div>
    </aside>
  );
}
