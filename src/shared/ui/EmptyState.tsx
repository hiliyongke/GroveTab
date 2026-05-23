/**
 * EmptyState — 通用空状态组件（增强版）
 *
 * 基于 antd Empty 封装，提供统一的空状态 UI。
 * 支持操作按钮、功能亮点说明等高级功能。
 *
 * @param title        - 主标题（必填）
 * @param description  - 补充描述文字
 * @param icon         - 自定义图标（可选）
 * @param size         - 尺寸：'default' | 'small'
 * @param actions      - 操作按钮数组
 * @param hints        - 功能亮点列表
 */

import { Empty, Button, Space, Typography } from 'antd';
import type { ReactNode } from 'react';
import styles from './EmptyState.module.less';

const { Text, Paragraph } = Typography;

/**
 * 操作按钮项
 */
interface ActionItem {
  /** 按钮文案 */
  text: string;
  /** 点击回调 */
  onClick: () => void;
  /** antd 按钮类型（默认 primary） */
  type?: 'primary' | 'default' | 'dashed' | 'link';
}

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
  /** 操作按钮数组（支持多个，引导用户下一步） */
  actions?: ActionItem[];
  /** 功能亮点列表（帮助新用户理解价值） */
  hints?: string[];
}

/**
 * 通用空状态组件（增强版）
 *
 * 提供统一的空状态 UI，基于 antd Empty 封装。
 * 支持自定义图标、标题、描述文字、操作按钮和功能亮点。
 *
 * @param props 组件属性
 * @param props.title       主标题
 * @param props.description 补充描述文字
 * @param props.icon        自定义图标
 * @param props.size        尺寸（default | small）
 * @param props.className   自定义类名
 * @param props.actions     操作按钮数组
 * @param props.hints      功能亮点列表
 * @returns 空状态 UI
 */
export function EmptyState({
  title,
  description,
  icon,
  size = 'default',
  className,
  actions,
  hints,
}: EmptyStateProps) {
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
        <Paragraph type="secondary" className={styles['empty-state__description']}>
          {description}
        </Paragraph>
      )}
      {hints && hints.length > 0 && (
        <div className={styles['empty-state__hints']}>
          {hints.map((hint, i) => (
            <div key={i} className={styles['empty-state__hint-item']}>
              <span className={styles['empty-state__hint-dot']} />
              <Text type="secondary" className={styles['empty-state__hint-text']}>
                {hint}
              </Text>
            </div>
          ))}
        </div>
      )}
      {actions && actions.length > 0 && (
        <div className={styles['empty-state__actions']}>
          <Space wrap>
            {actions.map((action, i) => (
              <Button
                key={i}
                type={action.type ?? 'primary'}
                size={size === 'small' ? 'small' : 'middle'}
                onClick={action.onClick}
              >
                {action.text}
              </Button>
            ))}
          </Space>
        </div>
      )}
    </div>
  );
}
