import { Button } from 'antd';
import { GripVertical, Trash2 } from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import type { DashboardWidgetType } from '@/shared/types';

interface WidgetCardProps {
  title: string;
  type?: DashboardWidgetType;
  editing: boolean;
  onRemove?: () => void;
  children: React.ReactNode;
  /**
   * v1.3：react-grid-layout 通过 CSS 类选择器精确识别拖拽句柄，
   * 仅当此 className 的元素被按下时才启动拖拽，避免点到 widget 内部按钮就误拖。
   */
  dragHandleClassName?: string;
}

const TYPE_TONE: Partial<Record<DashboardWidgetType, string>> = {
  clock: '#6a9bcc',
  weather: '#6a9bcc',
  calendar: '#788c5d',
  dailyQuote: '#d97757',
  speedDial: '#6a9bcc',
  pomodoro: '#d97757',
  todo: '#788c5d',
  sticky: '#d97757',
  countdown: '#d97757',
  workCountdown: '#788c5d',
  searchBox: '#6a9bcc',
  waterReminder: '#6a9bcc',
  habitTracker: '#788c5d',
  timestampTool: '#6a9bcc',
  jsonFormatter: '#788c5d',
  networkInfo: '#6a9bcc',
};

export function WidgetCard({
  title,
  type,
  editing,
  onRemove,
  children,
  dragHandleClassName,
}: WidgetCardProps) {
  const tone =
    type !== undefined ? (TYPE_TONE[type] ?? 'var(--ant-color-primary)') : 'var(--ant-color-primary)';
  const cardStyle = { '--app-widget-tone': tone } as React.CSSProperties;
  const dragHandleClasses = [dragHandleClassName, 'app-widget-card__drag']
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={`app-card-interactive app-widget-card${editing ? ' app-widget-card--editing' : ''}`}
      role="group"
      aria-label={`${title} 小组件`}
      style={cardStyle}
    >
      <div className="app-widget-card__head">
        <div className="app-widget-card__title-wrap">
          {editing && (
            <button
              type="button"
              className={dragHandleClasses}
              aria-label={`拖拽移动 ${title}`}
            >
              <GripVertical size={ICON_SIZE.MEDIUM} />
            </button>
          )}
          <span aria-hidden className="app-widget-card__tone-dot" />
          <div className="app-widget-card__title">{title}</div>
        </div>

        {editing && (
          <Button
            type="text"
            size="small"
            danger
            icon={<Trash2 size={ICON_SIZE.MEDIUM} />}
            onClick={onRemove}
            aria-label={`删除 ${title}`}
            className="app-dashboard__no-drag app-widget-card__remove"
          />
        )}
      </div>

      <div className="app-widget-card__body">{children}</div>
    </div>
  );
}
