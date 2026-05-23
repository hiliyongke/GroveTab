/**
 * LoadingState — 通用加载状态组件
 *
 * 基于 antd Spin 封装，提供统一的加载状态 UI。
 * 支持自定义提示文字、大小和样式。
 *
 * @param tip       - 加载提示文字
 * @param size      - 尺寸：'small' | 'default' | 'large'
 * @param spinning  - 是否显示加载状态（默认 true）
 * @param className - 自定义类名
 * @param style    - 自定义样式
 */

import { Spin } from 'antd';
import type { CSSProperties } from 'react';
import styles from './LoadingState.module.less';

/**
 * LoadingState 组件属性
 */
interface LoadingStateProps {
  /** 加载提示文字 */
  tip?: string;
  /** 尺寸：'small' | 'default' | 'large' */
  size?: 'small' | 'default' | 'large';
  /** 是否显示加载状态（默认 true） */
  spinning?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
}

/**
 * 通用加载状态组件
 *
 * 提供统一的加载状态 UI，基于 antd Spin 封装。
 * 支持自定义提示文字、尺寸和样式。
 *
 * @param props 组件属性
 * @param props.tip      加载提示文字
 * @param props.size     尺寸（small | default | large）
 * @param props.spinning 是否显示加载状态
 * @param props.className 自定义类名
 * @param props.style    自定义样式
 * @returns 加载状态 UI
 */
export function LoadingState({
  tip,
  size = 'default',
  spinning = true,
  className,
  style,
}: LoadingStateProps) {
  return (
    <div
      className={`${styles['loading-state']} ${styles[`loading-state--${size}`]} ${className ?? ''}`}
      style={style}
    >
      <Spin
        spinning={spinning}
        tip={tip}
        size={size === 'large' ? 'large' : 'default'}
        className={styles['loading-state__spin']}
      />
    </div>
  );
}
