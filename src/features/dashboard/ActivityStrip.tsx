/**
 * ActivityStrip —— 最近操作状态区（F-27）
 *
 * 规则（需求 20）：
 *   - recentActivity 非空 AND 最近条目 ts 距今 ≤ 60min 时才渲染
 *   - 每条展示：图标 + 摘要 + 最多 2 个行动按钮
 *   - uiVisibility.activityStrip=false 时不渲染
 *
 * 数据来自 metadata-slice.recentActivity（由 archive/restore/import/export/permission
 * /clear_archive/dedup_merge/snapshot 等事件推入）。
 */

import { memo, useMemo } from 'react';
import { Button, Space, theme } from 'antd';
import { Archive, RotateCcw, Upload, Download, ShieldCheck, Trash2, Copy, Camera, Eye } from 'lucide-react';
import type { ActivityAction, ActivityRecord, ActivityType } from '@/shared/types';
import { useMetadataStore, useSettingsStore, useUndoStore } from '@/store';
import { useT } from '@/shared/i18n';

const VISIBLE_WINDOW_MS = 60 * 60 * 1000;

interface ActivityStripProps {
  /** 供外层把"打开归档"等跨组件动作接进来 */
  onOpenArchive: (sessionId?: string) => void;
  /** 打开导入结果 Modal */
  onOpenImportResult?: (id: string) => void;
}

function iconFor(type: ActivityType, size = 14) {
  switch (type) {
    case 'archive':
      return <Archive size={size} />;
    case 'restore':
      return <RotateCcw size={size} />;
    case 'import':
      return <Upload size={size} />;
    case 'export':
      return <Download size={size} />;
    case 'permission':
      return <ShieldCheck size={size} />;
    case 'clear_archive':
      return <Trash2 size={size} />;
    case 'dedup_merge':
      return <Copy size={size} />;
    case 'snapshot':
      return <Camera size={size} />;
    default:
      return <Eye size={size} />;
  }
}

export const ActivityStrip = memo(function ActivityStrip({ onOpenArchive, onOpenImportResult }: ActivityStripProps) {
  const recentActivity = useMetadataStore((s) => s.recentActivity);
  const activityVisible = useSettingsStore((s) => s.settings.uiVisibility?.activityStrip);
  const undoRecord = useUndoStore((s) => s.undoRecord);
  const { t } = useT();
  const { token } = theme.useToken();

  const shouldRender = useMemo(() => {
    if (activityVisible === false) return false;
    if (recentActivity.length === 0) return false;
    const latest = recentActivity[0];
    return Date.now() - latest.ts <= VISIBLE_WINDOW_MS;
  }, [recentActivity, activityVisible]);

  if (!shouldRender) return null;

  const handleAction = (action: ActivityAction, record: ActivityRecord) => {
    switch (action.kind) {
      case 'undo':
        if (record.undoGroupId !== undefined) {
          void undoRecord(record.undoGroupId);
        }
        break;
      case 'open_archive':
        onOpenArchive(action.payload);
        break;
      case 'open_import_result':
        if (onOpenImportResult !== undefined && action.payload !== undefined) {
          onOpenImportResult(action.payload);
        }
        break;
      case 'custom':
      default:
        break;
    }
  };

  return (
    <section
      aria-label={t('activity.title')}
      style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        padding: '6px 2px 10px',
        margin: '0 0 4px',
        scrollbarWidth: 'thin',
      }}
    >
      {recentActivity.map((record) => {
        const iconBase = iconFor(record.type);
        return (
          <div
            key={record.id}
            style={{
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px 6px 8px',
              borderRadius: 999,
              background: token.colorFillTertiary,
              border: `1px solid ${token.colorBorderSecondary}`,
              maxWidth: 520,
            }}
          >
            <span style={{ display: 'inline-flex', color: token.colorTextSecondary }}>{iconBase}</span>
            <span
              style={{
                fontSize: 12.5,
                color: token.colorText,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: '0 1 auto',
              }}
              title={record.summary}
            >
              {record.summary}
            </span>
            {(record.primaryAction !== undefined || record.secondaryAction !== undefined) && (
              <Space size={4} style={{ flexShrink: 0 }}>
                {record.primaryAction !== undefined && (
                  <Button
                    size="small"
                    type="link"
                    onClick={() => handleAction(record.primaryAction!, record)}
                    style={{ padding: '0 4px', fontSize: 12 }}
                  >
                    {record.primaryAction.label}
                  </Button>
                )}
                {record.secondaryAction !== undefined && (
                  <Button
                    size="small"
                    type="link"
                    onClick={() => handleAction(record.secondaryAction!, record)}
                    style={{ padding: '0 4px', fontSize: 12, color: token.colorTextSecondary }}
                  >
                    {record.secondaryAction.label}
                  </Button>
                )}
              </Space>
            )}
          </div>
        );
      })}
    </section>
  );
});

export default ActivityStrip;
