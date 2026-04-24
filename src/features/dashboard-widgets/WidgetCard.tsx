import { Button, theme } from 'antd';
import { GripVertical, Trash2 } from 'lucide-react';

interface WidgetCardProps {
  title: string;
  editing: boolean;
  onRemove?: () => void;
  children: React.ReactNode;
  /**
   * v1.3：react-grid-layout 通过 CSS 类选择器精确识别拖拽句柄，
   * 仅当此 className 的元素被按下时才启动拖拽，避免点到 widget 内部按钮就误拖。
   */
  dragHandleClassName?: string;
}

export function WidgetCard({
  title,
  editing,
  onRemove,
  children,
  dragHandleClassName,
}: WidgetCardProps) {
  const { token } = theme.useToken();

  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        borderRadius: token.borderRadiusLG + 8,
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorderSecondary}`,
        boxShadow: token.boxShadowSecondary,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        overflow: 'hidden',
      }}
    >
      <div
        className={editing ? dragHandleClassName : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          cursor: editing && dragHandleClassName ? 'grab' : undefined,
          userSelect: editing ? 'none' : undefined,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {editing && (
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 10,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: token.colorFillTertiary,
                color: token.colorTextTertiary,
              }}
              aria-hidden
            >
              <GripVertical size={14} />
            </span>
          )}
          <div
            style={{
              fontSize: 13,
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Button
              type="text"
              size="small"
              danger
              icon={<Trash2 size={14} />}
              onClick={onRemove}
              aria-label="删除该组件"
              // 避免按钮触发拖拽：这个 className 告知 react-grid-layout 的 cancel 选择器
              className="grovetab-dashboard__no-drag"
            />
          </div>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}
