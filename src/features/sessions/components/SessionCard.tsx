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
import { Button, Tooltip, Popconfirm, Checkbox, Tag, Image, Flex, Typography } from "antd";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/zh-cn";
import "dayjs/locale/en";

dayjs.extend(relativeTime);
import type { ArchivedSession, ArchivedTab } from "@/shared/types";
import { useT } from "@/shared/i18n";
import { useFeatureFlagStore } from "@/shared/store/feature-flag-slice";
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
  const dayjsLocale = locale === "zh-CN" ? "zh-cn" : "en";
  const archiveTrashMerged = useFeatureFlagStore((s) => s.flags.archive_trash_merged);

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
  const isTrash = session.source === "trash" && archiveTrashMerged;

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
      className={`${styles["archive-card"]}${highlighted === true ? " " + styles["is-highlighted"] : ""}${selected === true ? " " + styles["is-selected"] : ""}${isTrash ? " " + styles["is-trash"] : ""}`}
    >
      {/* 顶部：复选框 + 自动标记 */}
      {(selectable === true || isAuto || isTrash) && (
        <Flex
          align="center"
          justify="space-between"
          gap={8}
          className={styles["archive-card__top"]}
        >
          {selectable === true && (
            <Checkbox
              className={styles["archive-card__checkbox"]}
              checked={selected === true}
              onChange={() => onToggleSelect?.(session.id)}
              aria-label={t("选择此会话")}
            />
          )}
          {isAuto && (
            <Tag color="gold" className={styles["archive-card__auto-tag"]}>
              <Sparkles size={ICON_SIZE.TINY} /> {t("自动快照")}
            </Tag>
          )}
          {isTrash && (
            <Tag color="red" className={styles["archive-card__auto-tag"]}>
              <Trash2 size={ICON_SIZE.TINY} /> {t("回收站")}
            </Tag>
          )}
        </Flex>
      )}

      {/* favicon 缩略行：会话指纹 */}
      <Flex align="center" gap={4} wrap className={styles["archive-card__favicons"]}>
        {previewFavicons.map((tab, idx) => (
          <Flex
            key={`${session.id}-fav-${idx}`}
            align="center"
            justify="center"
            className={styles["archive-card__favicon"]}
            title={tab.title || tab.url}
          >
            {tab.favIconUrl ? (
              <Image
                src={tab.favIconUrl}
                alt=""
                onError={(e) => {
                  e.currentTarget.style.visibility = "hidden";
                }}
                preview={false}
                fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
              />
            ) : (
              <span className={styles["archive-card__favicon-fallback"]}>
                {(tab.hostname || "?").charAt(0).toUpperCase()}
              </span>
            )}
          </Flex>
        ))}
        {overflowCount > 0 && (
          <Flex align="center" justify="center" className={styles["archive-card__favicon-more"]}>
            +{overflowCount}
          </Flex>
        )}
      </Flex>

      {/* 标题 + 描述 */}
      <Typography.Text className={styles["archive-card__title"]} ellipsis={{ tooltip: session.name }}>
        {highlightText(session.name)}
      </Typography.Text>
      <Flex align="center" gap={4} className={styles["archive-card__meta"]}>
        <Typography.Text>{t("{count} 个标签页", { count: session.tabCount })}</Typography.Text>
        <Typography.Text className={styles["archive-card__meta-dot"]}>·</Typography.Text>
        <Tooltip title={dayjs(session.createdAt).locale(dayjsLocale).format("YYYY-MM-DD HH:mm")}>
          <Typography.Text>
            {dayjs(session.createdAt).locale(dayjsLocale).fromNow()}
          </Typography.Text>
        </Tooltip>
      </Flex>

      {/* 展开详情：tab 列表 */}
      {expanded && (
        <Flex vertical gap={2} className={styles["archive-card__details"]}>
          {session.tabs.length === 0 ? (
            <Typography.Text className={styles["archive-card__details-empty"]}>
              {t("暂无归档会话")}
            </Typography.Text>
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
                    <Image
                      src={tab.favIconUrl}
                      alt=""
                      width={14}
                      height={14}
                      className={styles["archive-card__tab-favicon"]}
                      onError={(e) => {
                        e.currentTarget.style.visibility = "hidden";
                      }}
                      preview={false}
                      fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                    />
                  ) : (
                    <span className={styles["archive-card__tab-favicon-placeholder"]} />
                  )}
                  <Flex vertical className={styles["archive-card__tab-text"]}>
                    <Typography.Text className={styles["archive-card__tab-title"]} ellipsis>
                      {highlightText(tab.title || tab.url)}
                    </Typography.Text>
                    <Typography.Text className={styles["archive-card__tab-host"]} ellipsis>
                      {highlightText(tab.hostname || tab.url)}
                    </Typography.Text>
                  </Flex>
                </Button>
              );
            })
          )}
        </Flex>
      )}

      {/* 底部操作栏 */}
      <Flex align="center" gap={4} className={styles["archive-card__actions"]}>
        <Button
          type="primary"
          icon={<Undo2 size={ICON_SIZE.MEDIUM} />}
          onClick={() => onRestore(session.id)}
        >
          {t("恢复")}
        </Button>
        <Tooltip title={expanded ? t("收起") : t("展开")}>
          <Button
            type="text"
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
        <Tooltip title={t("重命名")}>
          <Button
            type="text"
            icon={<Pencil size={ICON_SIZE.MEDIUM} />}
            onClick={() => onStartRenaming(session)}
          />
        </Tooltip>
        {onShare && (
          <Tooltip title={t("分享")}>
            <Button
              type="text"
              icon={<Share2 size={ICON_SIZE.MEDIUM} />}
              onClick={() => onShare(session.id)}
            />
          </Tooltip>
        )}
        <Popconfirm
          title={t("确认删除")}
          description={t("删除后无法恢复，确定要删除此会话吗？")}
          onConfirm={() => onDelete(session.id)}
          okText={t("删除")}
          cancelText={t("取消")}
          okButtonProps={{ danger: true }}
        >
          <Tooltip title={t("删除")}>
            <Button type="text" danger icon={<Trash2 size={ICON_SIZE.MEDIUM} />} />
          </Tooltip>
        </Popconfirm>
      </Flex>
    </article>
  );
}
