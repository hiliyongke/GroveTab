import { Button, theme } from 'antd';
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
  const { token } = theme.useToken();
  const tone = type !== undefined ? (TYPE_TONE[type] ?? token.colorPrimary) : token.colorPrimary;

  return (
    <div
      className={`app-card-interactive app-widget-card${editing ? ' app-widget-card--editing' : ''}`}
      role="group"
      aria-label={`${title} 小组件`}
      style={
        {
          position: 'relative',
          height: '100%',
          borderRadius: token.borderRadiusLG + 10,
          background: 'var(--app-glass-bg)',
          border: `1px solid ${editing ? token.colorPrimaryBorder : token.colorBorderSecondary}`,
          boxShadow: editing ? token.boxShadowTertiary : 'var(--app-shadow-card)',
          backdropFilter: 'var(--app-glass-filter)',
          WebkitBackdropFilter: 'var(--app-glass-filter)',
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          overflow: 'hidden',
          ['--app-hover-border' as string]: editing
            ? token.colorPrimaryBorderHover
            : token.colorBorder,
        } as React.CSSProperties
      }
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          minHeight: 28,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {editing && (
            <button
              type="button"
              className={dragHandleClassName}
              aria-label={`拖拽移动 ${title}`}
              style={{
                width: 28,
                height: 28,
                border: 0,
                borderRadius: 10,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: token.colorFillTertiary,
                color: token.colorTextTertiary,
                cursor: 'grab',
                flexShrink: 0,
              }}
            >
              <GripVertical size={ICON_SIZE.MEDIUM} />
            </button>
          )}
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: tone,
              boxShadow: `0 0 0 4px ${tone}18`,
              flexShrink: 0,
            }}
          />
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: token.colorTextSecondary,
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </div>
        </div>

        {editing && (
          <Button
            type="text"
            size="small"
            danger
            icon={<Trash2 size={ICON_SIZE.MEDIUM} />}
            onClick={onRemove}
            aria-label={`删除 ${title}`}
            className="app-dashboard__no-drag"
            style={{ flexShrink: 0 }}
          />
        )}
      </div>

      <div
        className="app-widget-card__body"
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          scrollbarWidth: 'thin',
        }}
      >
        {children}
      </div>
    </div>
  );
}
