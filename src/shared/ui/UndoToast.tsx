/**
 * UndoToast — 关闭标签后的撤销提示（antd 版）
 *
 * 设计：
 *   - 底部居中浮动胶囊（使用 antd token 控制配色）
 *   - 撤销按钮使用 antd Button（primary）
 *   - 关闭按钮使用 antd Button（text）
 *   - 从下方滑入（原生 CSS 动画 .canopy-pulse / 自定义 transform）
 */

import { Button, theme } from 'antd';
import { UndoOutlined, CloseOutlined } from '@ant-design/icons';
import { useUndoStore } from '@/store';
import { useT } from '@/shared/i18n';

/**
 * 撤销提示浮条
 */
export function UndoToast() {
  const activeToast = useUndoStore((s) => s.activeToast);
  const undoRecord = useUndoStore((s) => s.undoRecord);
  const dismissToast = useUndoStore((s) => s.dismissToast);
  const { t } = useT();
  const { token } = theme.useToken();

  if (!activeToast) return null;

  const tabCount = activeToast.tabs.length;
  const label =
    tabCount === 1 ? t('undo.closeOne') : t('undo.close', { count: tabCount });

  const handleUndo = () => undoRecord(activeToast.id);

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 8px 8px 20px',
        borderRadius: 999,
        background: token.colorBgElevated,
        border: `1px solid ${token.colorBorderSecondary}`,
        boxShadow: token.boxShadow,
        backdropFilter: 'blur(16px)',
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 500, color: token.colorText }}>{label}</span>

      <Button
        type="primary"
        shape="round"
        size="small"
        icon={<UndoOutlined />}
        onClick={handleUndo}
      >
        {t('undo.action')}
      </Button>

      <Button
        type="text"
        shape="circle"
        size="small"
        icon={<CloseOutlined />}
        onClick={dismissToast}
        aria-label="Dismiss"
      />
    </div>
  );
}
