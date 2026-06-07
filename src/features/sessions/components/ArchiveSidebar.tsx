/**
 * ArchiveSidebar — 归档页左侧导航
 *
 * 提供时间段筛选（全部/今天/本周/本月/更早）+ 自动快照分区。
 * 与 DevToolsView 的 sidebar 风格对齐。
 */

import { useMemo } from "react";
import { Inbox, Sun, CalendarDays, CalendarRange, Clock, Sparkles, Trash2 } from "lucide-react";
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


export function ArchiveSidebar({ sessions, activeFilter, onSelectFilter }: ArchiveSidebarProps) {
  const { t } = useT();

  const filters = useMemo(
    () => [
      { id: "all" as const, label: t("全部"), Icon: Inbox },
      { id: "today" as const, label: t("今天"), Icon: Sun },
      { id: "week" as const, label: t("本周"), Icon: CalendarDays },
      { id: "month" as const, label: t("本月"), Icon: CalendarRange },
      { id: "earlier" as const, label: t("更早"), Icon: Clock },
    ],
    [t],
  );

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
      trash: 0,
    };
    for (const session of sessions) {
      const isAuto = session.source === "auto" || session.hidden === true;
      if (session.source === "trash") {
        result.trash += 1;
      }
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
          {filters.map((filter) => {
            const isActive = activeFilter === filter.id;
            return (
              <div
                key={filter.id}
                role="button"
                tabIndex={0}
                className={`${styles["archive-sidebar__item"]}${isActive ? " " + styles["is-active"] : ""}`}
                onClick={() => onSelectFilter(filter.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onSelectFilter(filter.id);
                }}
              >
                <span className={styles["archive-sidebar__item-icon"]}>
                  <filter.Icon size={ICON_SIZE.MEDIUM} />
                </span>
                <span className={styles["archive-sidebar__item-label"]}>{filter.label}</span>
                <span className={styles["archive-sidebar__item-count"]}>{counts[filter.id]}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles["archive-sidebar__group"]}>
        <div className={styles["archive-sidebar__group-title"]}>{t("专项")}</div>
        <div className={styles["archive-sidebar__list"]}>
          <div
            role="button"
            tabIndex={0}
            className={`${styles["archive-sidebar__item"]}${activeFilter === "auto" ? " " + styles["is-active"] : ""}`}
            onClick={() => onSelectFilter("auto")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onSelectFilter("auto");
            }}
          >
            <span className={styles["archive-sidebar__item-icon"]}>
              <Sparkles size={ICON_SIZE.MEDIUM} />
            </span>
            <span className={styles["archive-sidebar__item-label"]}>{t("自动快照")}</span>
            <span className={styles["archive-sidebar__item-count"]}>{counts.auto}</span>
          </div>
          <div
            role="button"
            tabIndex={0}
            className={`${styles["archive-sidebar__item"]}${activeFilter === "trash" ? " " + styles["is-active"] : ""}`}
            onClick={() => onSelectFilter("trash")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onSelectFilter("trash");
            }}
          >
            <span className={styles["archive-sidebar__item-icon"]}>
              <Trash2 size={ICON_SIZE.MEDIUM} />
            </span>
            <span className={styles["archive-sidebar__item-label"]}>{t("回收站")}</span>
            <span className={styles["archive-sidebar__item-count"]}>{counts.trash}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
