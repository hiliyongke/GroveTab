/**
 * SkeletonWidget · v1.3
 *
 * Widget 级的骨架屏，替代原先全卡片 Spin —— 视觉噪声更低、
 * 与真实 widget 的"上标题 + 下内容"结构一一对应。
 *
 * 使用场景：
 *  - `<Suspense fallback={<SkeletonWidget />}>…</Suspense>`
 *  - ErrorBoundary reset → 短暂显示骨架避免闪烁
 */
import { theme } from 'antd';

interface SkeletonWidgetProps {
  /** 行数（内容区），默认 3 行 */
  rows?: number;
  /** 是否显示顶部标题骨架，默认 true */
  showHeader?: boolean;
  /** aria 语义化标签 */
  label?: string;
}

export function SkeletonWidget({ rows = 3, showHeader = true, label }: SkeletonWidgetProps) {
  const { token } = theme.useToken();
  const base = token.colorFillSecondary;

  const pulse: React.CSSProperties = {
    background: base,
    borderRadius: 6,
    animation: 'grovetab-skeleton-pulse 1.4s ease-in-out infinite',
  };

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label ?? '加载中'}
      style={{
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        height: '100%',
      }}
    >
      {showHeader && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ ...pulse, width: 20, height: 20, borderRadius: '50%' }} />
          <div style={{ ...pulse, width: '40%', height: 14 }} />
        </div>
      )}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            ...pulse,
            width: `${100 - i * 10}%`,
            height: 12,
          }}
        />
      ))}
      {/* 仅定义一次全局 keyframes */}
      <style>
        {`@keyframes grovetab-skeleton-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @media (prefers-reduced-motion: reduce) {
          [role="status"] > * { animation: none !important; }
        }`}
      </style>
    </div>
  );
}
