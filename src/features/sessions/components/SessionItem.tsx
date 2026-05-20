/**
 * SessionItem — 归档会话列表中的单个条目
 *
 * 包含：
 *   - 主行：展开箭头 + 图标 + 标题/描述 + 操作按钮
 *   - 展开详情：tab 列表 + 单独打开按钮
 *   - 重命名输入态
 */


import {
  Undo2,
  Trash2,
  ChevronRight,
  Link,
  Pencil,
  Save,
  Share2,
} from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { Button, List, Tooltip, Input, Popconfirm, theme, Checkbox } from 'antd';
import { format } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';
import type { ArchivedSession, ArchivedTab } from '@/shared/types';
import { useT } from '@/shared/i18n';

interface SessionItemProps {
  session: ArchivedSession;
  isExpanded: boolean;
  isRenaming: boolean;
  renamingValue: string;
  locale: 'zh-CN' | 'en';
  onToggleExpand: () => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  onStartRenaming: (session: ArchivedSession) => void;
  onRenameConfirm: (id: string) => void;
  onRenameChange: (value: string) => void;
  onRenameCancel: () => void;
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
  isRenaming,
  renamingValue,
  locale,
  onToggleExpand,
  onRestore,
  onDelete,
  onStartRenaming,
  onRenameConfirm,
  onRenameChange,
  onRenameCancel,
  onOpenSingle,
  onShare,
  selectable,
  selected,
  onToggleSelect,
  highlightQuery,
  matchedTabIndexes,
}: SessionItemProps) {
  const { t } = useT();
  const { token } = theme.useToken();

  /** 高亮匹配关键词的文本 */
  const highlightText = (text: string): React.ReactNode => {
    if (!highlightQuery || !highlightQuery.trim()) return text;
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
        <mark style={{
          background: token.colorPrimaryBg,
          color: token.colorPrimary,
          padding: '0 1px',
          borderRadius: 2,
          fontWeight: 600,
        }}>{match}</mark>
        {after}
      </>
    );
  };

  /** 搜索时标签页排序：匹配的排前面 */
  const sortedTabs = (() => {
    if (!matchedTabIndexes || matchedTabIndexes.size === 0) return session.tabs.map((tab, idx) => ({ tab, originalIdx: idx }));
    const matched: { tab: ArchivedTab; originalIdx: number }[] = [];
    const unmatched: { tab: ArchivedTab; originalIdx: number }[] = [];
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
    <List.Item
      style={{
        flexDirection: 'column',
        alignItems: 'stretch',
        padding: '12px 0',
      }}
    >
      {/* 主行 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          width: '100%',
          cursor: 'pointer',
        }}
        onClick={onToggleExpand}
      >
        <Tooltip title={isExpanded ? t('archive.collapse') : t('archive.expand')}>
          <Button
            type="text"
            size="small"
            icon={
              <ChevronRight
                size={ICON_SIZE.TINY}
                style={{
                  transition: 'transform 0.2s',
                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)',
                }}
              />
            }
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
          />
        </Tooltip>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: token.borderRadius,
            background: token.colorFillSecondary,
            color: token.colorTextTertiary,
            flexShrink: 0,
          }}
        >
          <Save size={ICON_SIZE.LARGE} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {isRenaming ? (
            <Input
              size="small"
              value={renamingValue}
              onChange={(e) => onRenameChange(e.target.value)}
              onPressEnter={() => onRenameConfirm(session.id)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  onRenameCancel();
                }
              }}
              onClick={(e) => e.stopPropagation()}
              style={{ fontSize: 13, fontWeight: 500 }}
              autoFocus
            />
          ) : (
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 500,
                color: token.colorText,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {highlightText(session.name)}
            </div>
          )}
          <div style={{ fontSize: 11.5, color: token.colorTextTertiary, marginTop: 2 }}>
            {t('archive.tabCount', { count: session.tabCount })}
            <span style={{ margin: '0 6px', color: token.colorBorder }}>·</span>
            {format(session.createdAt, 'MMM d, HH:mm', {
              locale: locale === 'zh-CN' ? zhCN : enUS,
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          {selectable === true && (
            <Checkbox
              checked={selected === true}
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelect?.(session.id);
              }}
              style={{ marginRight: 4 }}
              aria-label={t('archive.selectToggle')}
            />
          )}
          <Tooltip title={t('archive.restore')}>
            <Button
              type="text"
              icon={<Undo2 size={ICON_SIZE.MEDIUM} />}
              onClick={() => onRestore(session.id)}
            />
          </Tooltip>
          <Tooltip title={t('archive.rename')}>
            <Button
              type="text"
              icon={<Pencil size={ICON_SIZE.MEDIUM} />}
              onClick={() => onStartRenaming(session)}
            />
          </Tooltip>
          {onShare !== undefined && (
            <Tooltip title={t('archive.share')}>
              <Button
                type="text"
                icon={<Share2 size={ICON_SIZE.MEDIUM} />}
                onClick={() => onShare(session.id)}
              />
            </Tooltip>
          )}
          <Popconfirm
            title={t('archive.deleteConfirmTitle')}
            description={t('archive.deleteConfirmDesc')}
            onConfirm={() => onDelete(session.id)}
            okText={t('archive.deleteConfirmOk')}
            cancelText={t('archive.deleteConfirmCancel')}
            okButtonProps={{ danger: true }}
          >
            <Tooltip title={t('archive.delete')}>
              <Button
                type="text"
                danger
                icon={<Trash2 size={ICON_SIZE.MEDIUM} />}
              />
            </Tooltip>
          </Popconfirm>
        </div>
      </div>

      {/* 展开详情 */}
      {isExpanded && (
        <div
          style={{
            marginTop: 8,
            marginLeft: 40,
            padding: 8,
            background: token.colorFillQuaternary,
            borderRadius: token.borderRadius,
            maxHeight: 260,
            overflowY: 'auto',
          }}
        >
          {session.tabs.length === 0 ? (
            <div
              style={{
                padding: 16,
                textAlign: 'center',
                fontSize: 12,
                color: token.colorTextTertiary,
              }}
            >
              {t('archive.empty')}
            </div>
          ) : (
            sortedTabs.map(({ tab, originalIdx }) => {
              const isMatched = matchedTabIndexes?.has(originalIdx) ?? false;
              return (
                <div
                  key={`${session.id}-${originalIdx}`}
                  className="app-row-hover"
                  style={
                    {
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '6px 8px',
                      borderRadius: token.borderRadiusSM,
                      ['--app-row-hover-bg' as string]: token.colorFillSecondary,
                      background: isMatched ? token.colorPrimaryBg : undefined,
                    } as React.CSSProperties
                  }
                >
                  {tab.favIconUrl ? (
                    <img
                      src={tab.favIconUrl}
                      alt=""
                      width={14}
                      height={14}
                      style={{ flexShrink: 0, borderRadius: 2 }}
                      onError={(e) => {
                        (e.currentTarget).style.visibility = 'hidden';
                      }}
                    />
                  ) : (
                    <div style={{ width: 14, height: 14, flexShrink: 0 }} />
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12.5,
                        color: token.colorText,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={tab.title || tab.url}
                    >
                      {highlightText(tab.title || tab.url)}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: token.colorTextTertiary,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {highlightText(tab.hostname || tab.url)}
                    </div>
                  </div>

                  <Tooltip title={t('archive.openTab')}>
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
