/**
 * EmptyState — 通用空状态组件
 *
 * 基于 antd Empty 封装，提供统一的空状态 UI。
 * 可用于表格、列表、卡片等场景的无数据提示。
 *
 * @param title        - 主标题（必填）
 * @param description  - 补充描述文字
 * @param icon         - 自定义图标（可选）
 * @param size         - 尺寸：'default' | 'small'
 */

import { Empty } from 'antd';
import type { ReactNode } from 'react';
import styles from './EmptyState.module.less';

/**
 * EmptyState 组件属性
 */
interface EmptyStateProps {
  /** 主标题（必填） */
  title: string;
  /** 补充描述文字 */
  description?: string;
  /** 自定义图标（覆盖默认 Empty 图片） */
  icon?: ReactNode;
  /** 尺寸：'default' | 'small' */
  size?: 'default' | 'small';
  /** 自定义类名 */
  className?: string;
}

/**
 * 通用空状态组件
 *
 * 提供统一的空状态 UI，基于 antd Empty 封装。
 * 支持自定义图标、标题、描述文字和尺寸。
 *
 * @param props 组件属性
 * @param props.title       主标题
 * @param props.description 补充描述文字
 * @param props.icon        自定义图标
 * @param props.size        尺寸（default | small）
 * @param props.className   自定义类名
 * @returns 空状态 UI
 */
export function EmptyState({ title, description, icon, size = 'default', className }: EmptyStateProps) {
  const image = icon ? <span className={styles['empty-state__icon']}>{icon}</span> : undefined;

  return (
    <div className={`${styles['empty-state']} ${styles[`empty-state--${size}`]} ${className ?? ''}`}>
      <Empty
        image={image}
        description={
          <span className={styles['empty-state__title']}>{title}</span>
        }
        className={styles['empty-state__empty']}
      />
      {description && (
        <div className={styles['empty-state__description']}>
          {description}
        </div>
      )}
    </div>
  );
}
