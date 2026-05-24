/**
 * SessionCard — 归档会话卡片（卡片网格视图）
 *
 * 比 SessionItem 更具"封面感"的版本：
 *   - 顶部展示前 N 个 favicon 缩略，给会话一个视觉指纹
 *   - 标题区：会话名 + tab 数 + 相对时间
 *   - 操作区：恢复 / 重命名 / 分享 / 删除（hover 浮现）
 *   - 多选模式：左上角复选框
 *
 * 与 SessionItem 共存：旧 list 视图保留作为"紧凑模式"；卡片为默认密度。
 */

import { useMemo } from "react";
import { Undo2, Trash2, Pencil, Share2, ChevronDown, Sparkles } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { Button, Tooltip, Popconfirm, Checkbox, Tag } from "antd";
import { format, formatDistanceToNow } from "date-fns";
import { zhCN, enUS } from "date-fns/locale";
import type { ArchivedSession, ArchivedTab } from "@/shared/types";
import { useT } from "@/shared/i18n";
import styles from "../styles/archive.module.less";

interface SessionCardProps {
  session: ArchivedSession;
  locale: "zh-CN" | "en";
  highlighted?: boolean;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  onStartRenaming: (session: ArchivedSession) => void;
  onShare?: (id: string) => void;
  onOpenSingle: (tab: ArchivedTab) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  /** 搜索高亮关键词 */
  highlightQuery?: string;
  /** 命中的标签页索引集合（搜索时用于在缩略行优先展示命中的 favicon） */
  matchedTabIndexes?: Set<number>;
  /** 展开/折叠详情区 */
  expanded: boolean;
  onToggleExpand: (id: string) => void;
}

const FAVICON_PREVIEW_LIMIT = 8;

export function SessionCard({
  session,
  locale,
  highlighted,
  onRestore,
  onDelete,
  onStartRenaming,
  onShare,
  onOpenSingle,
  selectable,
  selected,
  onToggleSelect,
  highlightQuery,
  matchedTabIndexes,
  expanded,
  onToggleExpand,
}: SessionCardProps) {
  const { t } = useT();
  const dateLocale = locale === "zh-CN" ? zhCN : enUS;

  /** 命中 tabs 优先排前面的 preview faves */
  const previewFavicons = useMemo(() => {
    if (matchedTabIndexes && matchedTabIndexes.size > 0) {
      const matched: ArchivedTab[] = [];
      const rest: ArchivedTab[] = [];
      session.tabs.forEach((tab, idx) => {
        if (matchedTabIndexes.has(idx)) matched.push(tab);
        else rest.push(tab);
      });
      return [...matched, ...rest].slice(0, FAVICON_PREVIEW_LIMIT);
    }
    return session.tabs.slice(0, FAVICON_PREVIEW_LIMIT);
  }, [session.tabs, matchedTabIndexes]);

  const overflowCount = Math.max(0, session.tabs.length - FAVICON_PREVIEW_LIMIT);
  const isAuto = session.source === "auto" || session.hidden === true;

  const highlightText = (text: string): React.ReactNode => {
    if (!highlightQuery?.trim()) return text;
    const lowerText = text.toLowerCase();
    const lowerQuery = highlightQuery.trim().toLowerCase();
    const idx = lowerText.indexOf(lowerQuery);
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="app-archive-highlight">
          {text.slice(idx, idx + highlightQuery.trim().length)}
        </mark>
        {text.slice(idx + highlightQuery.trim().length)}
      </>
    );
  };

  return (
    <article
      className={`${styles["archive-card"]}${highlighted === true ? " " + styles["is-highlighted"] : ""}${selected === true ? " " + styles["is-selected"] : ""}`}
    >
      {/* 顶部：复选框 + 自动标记 */}
      {(selectable === true || isAuto) && (
        <div className={styles["archive-card__top"]}>
          {selectable === true && (
            <Checkbox
              className={styles["archive-card__checkbox"]}
              checked={selected === true}
              onChange={() => onToggleSelect?.(session.id)}
              aria-label={t("archive.selectToggle")}
            />
          )}
          {isAuto && (
            <Tag color="gold" className={styles["archive-card__auto-tag"]}>
              <Sparkles size={ICON_SIZE.TINY} /> {t("archive.filter.autoSnapshots")}
            </Tag>
          )}
        </div>
      )}

      {/* favicon 缩略行：会话指纹 */}
      <div className={styles["archive-card__favicons"]}>
        {previewFavicons.map((tab, idx) => (
          <span
            key={`${session.id}-fav-${idx}`}
            className={styles["archive-card__favicon"]}
            title={tab.title || tab.url}
          >
            {tab.favIconUrl ? (
              <img
                src={tab.favIconUrl}
                alt=""
                onError={(e) => {
                  e.currentTarget.style.visibility = "hidden";
                }}
              />
            ) : (
              <span className={styles["archive-card__favicon-fallback"]}>
                {(tab.hostname || "?").charAt(0).toUpperCase()}
              </span>
            )}
          </span>
        ))}
        {overflowCount > 0 && (
          <span className={styles["archive-card__favicon-more"]}>+{overflowCount}</span>
        )}
      </div>

      {/* 标题 + 描述 */}
      <div className={styles["archive-card__title"]}>{highlightText(session.name)}</div>
      <div className={styles["archive-card__meta"]}>
        <span>{t("archive.tabCount", { count: session.tabCount })}</span>
        <span className={styles["archive-card__meta-dot"]}>·</span>
        <Tooltip title={format(session.createdAt, "yyyy-MM-dd HH:mm", { locale: dateLocale })}>
          <span>
            {formatDistanceToNow(session.createdAt, { addSuffix: true, locale: dateLocale })}
          </span>
        </Tooltip>
      </div>

      {/* 展开详情：tab 列表 */}
      {expanded && (
        <div className={styles["archive-card__details"]}>
          {session.tabs.length === 0 ? (
            <div className={styles["archive-card__details-empty"]}>{t("archive.empty")}</div>
          ) : (
            session.tabs.map((tab, idx) => {
              const isMatched = matchedTabIndexes?.has(idx) ?? false;
              return (
                <Button
                  key={`${session.id}-tab-${idx}`}
                  type="text"
                  className={`${styles["archive-card__tab-row"]}${isMatched ? " " + styles["is-matched"] : ""}`}
                  onClick={() => onOpenSingle(tab)}
                  title={tab.title || tab.url}
                >
                  {tab.favIconUrl ? (
                    <img
                      src={tab.favIconUrl}
                      alt=""
                      width={14}
                      height={14}
                      className={styles["archive-card__tab-favicon"]}
                      onError={(e) => {
                        e.currentTarget.style.visibility = "hidden";
                      }}
                    />
                  ) : (
                    <span className={styles["archive-card__tab-favicon-placeholder"]} />
                  )}
                  <span className={styles["archive-card__tab-text"]}>
                    <span className={styles["archive-card__tab-title"]}>
                      {highlightText(tab.title || tab.url)}
                    </span>
                    <span className={styles["archive-card__tab-host"]}>
                      {highlightText(tab.hostname || tab.url)}
                    </span>
                  </span>
                </Button>
              );
            })
          )}
        </div>
      )}

      {/* 底部操作栏 */}
      <div className={styles["archive-card__actions"]}>
        <Button
          type="primary"
          size="small"
          icon={<Undo2 size={ICON_SIZE.MEDIUM} />}
          onClick={() => onRestore(session.id)}
        >
          {t("archive.restore")}
        </Button>
        <Tooltip title={expanded ? t("archive.collapse") : t("archive.expand")}>
          <Button
            type="text"
            size="small"
            icon={
              <ChevronDown
                size={ICON_SIZE.MEDIUM}
                className={`${styles["archive-card__expand-icon"]}${expanded ? " " + styles["is-expanded"] : ""}`}
              />
            }
            onClick={() => onToggleExpand(session.id)}
          />
        </Tooltip>
        <span className={styles["archive-card__actions-spacer"]} />
        <Tooltip title={t("archive.rename")}>
          <Button
            type="text"
            size="small"
            icon={<Pencil size={ICON_SIZE.MEDIUM} />}
            onClick={() => onStartRenaming(session)}
          />
        </Tooltip>
        {onShare && (
          <Tooltip title={t("archive.share")}>
            <Button
              type="text"
              size="small"
              icon={<Share2 size={ICON_SIZE.MEDIUM} />}
              onClick={() => onShare(session.id)}
            />
          </Tooltip>
        )}
        <Popconfirm
          title={t("archive.deleteConfirmTitle")}
          description={t("archive.deleteConfirmDesc")}
          onConfirm={() => onDelete(session.id)}
          okText={t("archive.deleteConfirmOk")}
          cancelText={t("archive.deleteConfirmCancel")}
          okButtonProps={{ danger: true }}
        >
          <Tooltip title={t("archive.delete")}>
            <Button type="text" size="small" danger icon={<Trash2 size={ICON_SIZE.MEDIUM} />} />
          </Tooltip>
        </Popconfirm>
      </div>
    </article>
  );
}
