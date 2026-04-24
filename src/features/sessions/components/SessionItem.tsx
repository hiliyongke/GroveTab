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
import { Button, List, Tooltip, Input, Popconfirm, theme } from 'antd';
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
}: SessionItemProps) {
  const { t } = useT();
  const { token } = theme.useToken();

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
              {session.name}
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
            <input
              type="checkbox"
              checked={selected === true}
              onChange={() => onToggleSelect?.(session.id)}
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
            session.tabs.map((tab, idx) => (
              <div
                key={`${session.id}-${idx}`}
                className="canopy-row-hover"
                style={
                  {
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '6px 8px',
                    borderRadius: token.borderRadiusSM,
                    // 与原视觉保持一致——hover 用 secondary 填色（比默认的 tertiary 更显眼）
                    ['--canopy-row-hover-bg' as string]: token.colorFillSecondary,
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
                    {tab.title || tab.url}
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
                    {tab.hostname || tab.url}
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
            ))
          )}
        </div>
      )}
    </List.Item>
  );
}
