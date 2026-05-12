/**
 * NewbieTips — 新用户功能发现气泡
 *
 * 解决报告中指出的「功能发现成本高」问题：
 *   - 首次使用时在关键 UI 元素旁显示气泡提示
 *   - 使用 localStorage 记录已关闭的提示，不重复打扰
 *   - 支持多方向定位（top/bottom/left/right）
 *   - 动画入场，尊重 prefers-reduced-motion
 *
 * @param targetId  - 目标元素 ID（用于定位气泡）
 * @param content   - 气泡内容（支持 ReactNode）
 * @param position  - 气泡位置（默认 bottom）
 * @param storageKey - localStorage 存储键（默认 auto 生成）
 * @param onDismiss - 关闭回调（可选）
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { useT } from '@/shared/i18n';

interface NewbieTipsProps {
  /** 目标元素 ID（用于定位气泡） */
  targetId: string;
  /** 气泡主标题 */
  title: string;
  /** 气泡内容描述 */
  description?: string;
  /** 气泡位置 */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** localStorage 存储键（默认 auto 生成） */
  storageKey?: string;
  /** 关闭回调 */
  onDismiss?: () => void;
}

const STORAGE_PREFIX = 'canopy_newbie_';

/**
 * 检查某条提示是否已关闭
 */
function isDismissed(key: string): boolean {
  try {
    return localStorage.getItem(STORAGE_PREFIX + key) === '1';
  } catch {
    return false;
  }
}

/**
 * 标记某条提示为已关闭
 */
function markDismissed(key: string): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, '1');
  } catch {
    // 静默失败
  }
}

export function NewbieTips({
  targetId,
  title,
  description,
  position = 'bottom',
  storageKey,
  onDismiss,
}: NewbieTipsProps) {
  const { t } = useT();
  const key = storageKey ?? targetId;
  const [visible, setVisible] = useState(() => !isDismissed(key));
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!visible) return;

    const el = document.getElementById(targetId);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const bubbleW = 260;
    const bubbleH = 80;

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = rect.top - bubbleH - 12;
        left = rect.left + rect.width / 2 - bubbleW / 2;
        break;
      case 'bottom':
        top = rect.bottom + 12;
        left = rect.left + rect.width / 2 - bubbleW / 2;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - bubbleH / 2;
        left = rect.left - bubbleW - 12;
        break;
      case 'right':
        top = rect.top + rect.height / 2 - bubbleH / 2;
        left = rect.right + 12;
        break;
    }

    // 防止超出视窗
    left = Math.max(8, Math.min(left, window.innerWidth - bubbleW - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - bubbleH - 8));

    setCoords({ top, left });

    // 窗口 resize 时重新计算位置
    const onResize = () => {
      const r = el!.getBoundingClientRect();
      let t = 0;
      let l = 0;
      switch (position) {
        case 'top': t = r.top - bubbleH - 12; l = r.left + r.width / 2 - bubbleW / 2; break;
        case 'bottom': t = r.bottom + 12; l = r.left + r.width / 2 - bubbleW / 2; break;
        case 'left': t = r.top + r.height / 2 - bubbleH / 2; l = r.left - bubbleW - 12; break;
        case 'right': t = r.top + r.height / 2 - bubbleH / 2; l = r.right + 12; break;
      }
      l = Math.max(8, Math.min(l, window.innerWidth - bubbleW - 8));
      t = Math.max(8, Math.min(t, window.innerHeight - bubbleH - 8));
      setCoords({ top: t, left: l });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [visible, targetId, position]);

  if (!visible || !coords) return null;

  const handleDismiss = () => {
    markDismissed(key);
    setVisible(false);
    onDismiss?.();
  };

  const tipVars = {
    '--tip-top': `${coords.top}px`,
    '--tip-left': `${coords.left}px`,
    '--tip-arrow': position === 'bottom' ? '100%' : '0',
  } as unknown as CSSProperties;

  return (
    <div
      className={`newbie-tip newbie-tip--${position}`}
      style={tipVars}
      role="tooltip"
      aria-live="polite"
    >
      <div className="newbie-tip__arrow" />
      <div className="newbie-tip__body">
        <div className="newbie-tip__title">{title}</div>
        {description && (
          <div className="newbie-tip__desc">{description}</div>
        )}
      </div>
      <button
        className="newbie-tip__close"
        onClick={handleDismiss}
        aria-label={t('newbie.dismiss')}
      >
        ✕
      </button>
    </div>
  );
}
