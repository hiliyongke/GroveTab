/**
 * TabIcon — 通用标签图标组件
 *
 * 统一的 favicon 渲染逻辑，支持：
 *   - Favicon 图片（优先）
 *   - 域名首字母兜底（彩色圆圈）
 *   - 自定义兜底图标（可选）
 *
 * @param url         - 标签页 URL（用于获取 favicon 和域名首字母）
 * @param favIconUrl - Favicon URL（可选，优先使用）
 * @param title       - 标签页标题（可选，用于 accessibility）
 * @param size        - 图标尺寸（默认 16）
 * @param className   - 自定义类名
 * @param style      - 自定义样式
 * @param fallback    - 自定义兜底图标（可选）
 * @param tab        - 标签页对象（可选，传入后自动提取 url/favIconUrl/title）
 */

import type { CSSProperties, ReactNode } from 'react';
import type { LiveTab } from '@/shared/types';
import styles from './TabIcon.module.less';

/**
 * 获取域名首字母（大写）
 */
function getDomainInitial(url: string | undefined): string {
  if (!url) return '?';
  try {
    const hostname = new URL(url).hostname;
    return hostname.charAt(0).toUpperCase() || '?';
  } catch {
    return '?';
  }
}

/**
 * 从 URL 生成颜色（简单哈希）
 */
function getColorFromUrl(url: string | undefined): string {
  if (!url) return '#999';
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) - hash + url.charCodeAt(i)) | 0;
  }
  const colors = [
    '#f56a00', '#7265e6', '#ffbf00', '#00a2ae', '#87d068',
    '#36cfc9', '#6254db', '#f5317e',
  ];
  return colors[Math.abs(hash) % colors.length] ?? '#999';
}

/**
 * TabIcon 组件属性
 */
interface TabIconProps {
  /** 标签页 URL（用于获取 favicon 和域名首字母） */
  url?: string;
  /** Favicon URL（可选，优先使用） */
  favIconUrl?: string;
  /** 标签页标题（可选，用于 accessibility） */
  title?: string;
  /** 图标尺寸（默认 16） */
  size?: number;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
  /** 自定义兜底图标（可选） */
  fallback?: ReactNode;
  /** 标签页对象（可选，传入后自动提取 url/favIconUrl/title） */
  tab?: LiveTab;
}

/**
 * 通用标签图标组件
 *
 * 统一的 favicon 渲染逻辑，支持 favicon 图片和域名首字母兜底。
 *
 * @param props 组件属性
 * @param props.url        标签页 URL
 * @param props.favIconUrl Favicon URL
 * @param props.title      标签页标题
 * @param props.size       图标尺寸（默认 16）
 * @param props.className  自定义类名
 * @param props.style     自定义样式
 * @param props.fallback  自定义兜底图标
 * @param props.tab       标签页对象（自动提取）
 * @returns 标签图标 UI
 */
export function TabIcon({
  url,
  favIconUrl,
  title,
  size = 16,
  className,
  style,
  fallback,
  tab,
}: TabIconProps) {
  // 如果传入 tab，自动提取
  const finalUrl = url ?? tab?.url;
  const finalFavIconUrl = favIconUrl ?? tab?.favIconUrl;
  const finalTitle = title ?? tab?.title;

  const initial = getDomainInitial(finalUrl);
  const color = getColorFromUrl(finalUrl);

  const containerStyle: CSSProperties = {
    width: size,
    height: size,
    ...style,
  };

  const renderFavicon = () => (
    <img
      src={finalFavIconUrl}
      alt=""
      className={styles['tab-icon__favicon']}
      style={{ width: size, height: size }}
      onError={(e) => {
        // Favicon 加载失败，隐藏 img 显示兜底
        (e.target as HTMLImageElement).style.display = 'none';
      }}
    />
  );

  const renderFallback = () => (
    <span
      className={styles['tab-icon__fallback']}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.6,
        backgroundColor: color,
      }}
      aria-label={finalTitle ? `Favicon fallback for ${finalTitle}` : 'Favicon fallback'}
    >
      {initial}
    </span>
  );

  return (
    <span className={`${styles['tab-icon']} ${className ?? ''}`} style={containerStyle}>
      {fallback ? (
        <span className={styles['tab-icon__fallback']}>{fallback}</span>
      ) : finalFavIconUrl ? (
        <>
          {renderFavicon()}
          {renderFallback()}
        </>
      ) : (
        renderFallback()
      )}
    </span>
  );
}
