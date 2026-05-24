/**
 * SessionItem — 归档会话列表中的单个条目
 *
 * 包含：
 *   - 主行：展开箭头 + 图标 + 标题/描述 + 操作按钮
 *   - 展开详情：tab 列表 + 单独打开按钮
 *   - 重命名输入态
 */

import { Undo2, Trash2, ChevronRight, Link, Pencil, Save, Share2 } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { Button, List, Tooltip, Popconfirm, Checkbox, Image } from "antd";
import { format } from "date-fns";
import { zhCN, enUS } from "date-fns/locale";
import type { ArchivedSession, ArchivedTab } from "@/shared/types";
import { useT } from "@/shared/i18n";

interface SessionItemProps {
  session: ArchivedSession;
  isExpanded: boolean;
  locale: "zh-CN" | "en";
  onToggleExpand: () => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  onStartRenaming: (session: ArchivedSession) => void;
  onOpenSingle: (tab: ArchivedTab) => void;
  /** v1.0 封板：导出单个会话为 JSON（F-14 分享） */
  onShare?: (id: string) => void;
  /** v1.0 封板：多选复选框 */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  /** 搜索高亮关键词 */
  highlightQuery?: string;
  /** 匹配的标签页索引集合 */
  matchedTabIndexes?: Set<number>;
}

export function SessionItem({
  session,
  isExpanded,
  locale,
  onToggleExpand,
  onRestore,
  onDelete,
  onStartRenaming,
  onOpenSingle,
  onShare,
  selectable,
  selected,
  onToggleSelect,
  highlightQuery,
  matchedTabIndexes,
}: SessionItemProps) {
  const { t } = useT();

  /** 高亮匹配关键词的文本 */
  const highlightText = (text: string): React.ReactNode => {
    if (!highlightQuery?.trim()) return text;
    const lowerText = text.toLowerCase();
    const lowerQuery = highlightQuery.trim().toLowerCase();
    const idx = lowerText.indexOf(lowerQuery);
    if (idx === -1) return text;
    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + highlightQuery.trim().length);
    const after = text.slice(idx + highlightQuery.trim().length);
    return (
      <>
        {before}
        <mark className="app-archive-highlight">{match}</mark>
        {after}
      </>
    );
  };

  /** 搜索时标签页排序：匹配的排前面 */
  const sortedTabs = (() => {
    if (!matchedTabIndexes || matchedTabIndexes.size === 0)
      return session.tabs.map((tab, idx) => ({ tab, originalIdx: idx }));
    const matched: Array<{ tab: ArchivedTab; originalIdx: number }> = [];
    const unmatched: Array<{ tab: ArchivedTab; originalIdx: number }> = [];
    session.tabs.forEach((tab, idx) => {
      if (matchedTabIndexes.has(idx)) {
        matched.push({ tab, originalIdx: idx });
      } else {
        unmatched.push({ tab, originalIdx: idx });
      }
    });
    return [...matched, ...unmatched];
  })();

  return (
    <List.Item className="app-archive-item">
      {/* 主行 */}
      <div className="app-archive-item__main" onClick={onToggleExpand}>
        <Tooltip title={isExpanded ? t("archive.collapse") : t("archive.expand")}>
          <Button
            type="text"
            size="small"
            icon={
              <ChevronRight
                size={ICON_SIZE.TINY}
                className={`app-archive-item__toggle-icon${isExpanded ? " is-expanded" : ""}`}
              />
            }
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
          />
        </Tooltip>

        <div className="app-archive-item__icon">
          <Save size={ICON_SIZE.LARGE} />
        </div>

        <div className="app-archive-item__content">
          <div className="app-archive-item__name">{highlightText(session.name)}</div>
          <div className="app-archive-item__meta">
            {t("archive.tabCount", { count: session.tabCount })}
            <span className="app-archive-item__meta-divider">·</span>
            {format(session.createdAt, "MMM d, HH:mm", {
              locale: locale === "zh-CN" ? zhCN : enUS,
            })}
          </div>
        </div>

        <div className="app-archive-item__actions" onClick={(e) => e.stopPropagation()}>
          {selectable === true && (
            <Checkbox
              className="app-archive-item__checkbox"
              checked={selected === true}
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelect?.(session.id);
              }}
              aria-label={t("archive.selectToggle")}
            />
          )}
          <Tooltip title={t("archive.restore")}>
            <Button
              type="text"
              icon={<Undo2 size={ICON_SIZE.MEDIUM} />}
              onClick={() => onRestore(session.id)}
            />
          </Tooltip>
          <Tooltip title={t("archive.rename")}>
            <Button
              type="text"
              icon={<Pencil size={ICON_SIZE.MEDIUM} />}
              onClick={() => onStartRenaming(session)}
            />
          </Tooltip>
          {onShare !== undefined && (
            <Tooltip title={t("archive.share")}>
              <Button
                type="text"
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
              <Button type="text" danger icon={<Trash2 size={ICON_SIZE.MEDIUM} />} />
            </Tooltip>
          </Popconfirm>
        </div>
      </div>

      {/* 展开详情 */}
      {isExpanded && (
        <div className="app-archive-item__details">
          {session.tabs.length === 0 ? (
            <div className="app-archive-item__empty">{t("archive.empty")}</div>
          ) : (
            sortedTabs.map(({ tab, originalIdx }) => {
              const isMatched = matchedTabIndexes?.has(originalIdx) ?? false;
              return (
                <div
                  key={`${session.id}-${originalIdx}`}
                  className={`app-row-hover app-archive-item__tab-row${isMatched ? " is-matched" : ""}`}
                >
                  {tab.favIconUrl ? (
                    <Image
                      src={tab.favIconUrl}
                      alt=""
                      width={14}
                      height={14}
                      className="app-archive-item__tab-favicon"
                      onError={(e) => {
                        e.currentTarget.style.visibility = "hidden";
                      }}
                      preview={false}
                      fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                    />
                  ) : (
                    <div className="app-archive-item__tab-favicon-placeholder" />
                  )}

                  <div className="app-archive-item__tab-content">
                    <div className="app-archive-item__tab-title" title={tab.title || tab.url}>
                      {highlightText(tab.title || tab.url)}
                    </div>
                    <div className="app-archive-item__tab-subtitle">
                      {highlightText(tab.hostname || tab.url)}
                    </div>
                  </div>

                  <Tooltip title={t("archive.openTab")}>
                    <Button
                      type="text"
                      size="small"
                      icon={<Link size={ICON_SIZE.MEDIUM} />}
                      onClick={() => onOpenSingle(tab)}
                    />
                  </Tooltip>
                </div>
              );
            })
          )}
        </div>
      )}
    </List.Item>
  );
}
