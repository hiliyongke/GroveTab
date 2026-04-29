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
import { Button, Space } from 'antd';
import { Archive, RotateCcw, Upload, Download, ShieldCheck, Trash2, Copy, Camera, Eye } from 'lucide-react';
import type { ActivityAction, ActivityRecord, ActivityType } from '@/shared/types';
import { useMetadataStore, useSettingsStore, useUndoStore } from '@/store';
import { useT } from '@/shared/i18n';
import './styles/activity-strip.css';

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
    <section aria-label={t('activity.title')} className="activity-strip">
      {recentActivity.map((record) => {
        const iconBase = iconFor(record.type);
        return (
          <div key={record.id} className="activity-strip__item">
            <span className="activity-strip__icon">{iconBase}</span>
            <span
              className="activity-strip__summary"
              title={record.summary}
            >
              {record.summary}
            </span>
            {(record.primaryAction !== undefined || record.secondaryAction !== undefined) && (
              <Space size={4} className="activity-strip__actions">
                {record.primaryAction !== undefined && (
                  <Button
                    size="small"
                    type="link"
                    onClick={() => handleAction(record.primaryAction!, record)}
                    className="activity-strip__action-btn"
                  >
                    {record.primaryAction.label}
                  </Button>
                )}
                {record.secondaryAction !== undefined && (
                  <Button
                    size="small"
                    type="link"
                    onClick={() => handleAction(record.secondaryAction!, record)}
                    className="activity-strip__action-btn activity-strip__action-btn--secondary"
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
