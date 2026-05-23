/**
 * FeatureEmptyState — 增强的空状态组件
 *
 * 在 antd Empty 基础上增加：
 *   - 操作按钮（支持多个，引导用户下一步）
 *   - 功能亮点说明（帮助用户理解为何要使用此功能）
 *   - 支持图标/插画自定义
 *
 * @param title        - 主标题
 * @param description  - 补充说明文字
 * @param icon         - 自定义图标（覆盖默认 Empty 图片）
 * @param actions     - 操作按钮数组（支持多个）
 * @param hints        - 功能亮点列表（帮助新用户理解价值）
 * @param size         - 尺寸：'default' | 'small'
 */
import { Button, Space, Typography, Empty } from 'antd';
import type { ReactNode } from 'react';
import styles from './FeatureEmptyState.module.less';

const { Text, Paragraph } = Typography;

/** 操作按钮项 */
interface ActionItem {
  /** 按钮文案 */
  text: string;
  /** 点击回调 */
  onClick: () => void;
  /** antd 按钮类型（默认 primary） */
  type?: 'primary' | 'default' | 'dashed' | 'link';
}

/**
 * FeatureEmptyState 属性
 */
interface FeatureEmptyStateProps {
  /** 主标题（必填） */
  title: string;
  /** 补充说明文字 */
  description?: string;
  /** 自定义图标/插画（覆盖默认 Empty 图片） */
  icon?: ReactNode;
  /** 操作按钮数组（支持多个，引导用户下一步） */
  actions?: ActionItem[];
  /** 功能亮点列表（帮助新用户理解价值） */
  hints?: string[];
  /** 尺寸：'default' | 'small' */
  size?: 'default' | 'small';
}

/**
 * 增强的空状态组件（基于 antd Empty 封装）
 *
 * 设计：
 *   - 支持操作按钮引导用户下一步
 *   - 支持功能亮点说明，帮助新用户理解价值
 *   - 支持自定义图标/插画
 *
 * @param props 组件属性
 * @param props.title       主标题
 * @param props.description 补充说明文字
 * @param props.icon        自定义图标
 * @param props.actions     操作按钮数组
 * @param props.hints      功能亮点列表
 * @param props.size       尺寸（default | small）
 * @returns 增强的空状态 UI
 */
export function FeatureEmptyState({
  title,
  description,
  icon,
  actions,
  hints,
  size = 'default',
}: FeatureEmptyStateProps) {
  const image = icon ? <span className={styles['feature-empty__icon']}>{icon}</span> : undefined;

  return (
    <div className={`${styles['feature-empty']} ${styles[`feature-empty--${size}`]}`}>
      <Empty
        image={image}
        description={
          <span className={styles['feature-empty__title']}>{title}</span>
        }
        className={styles['feature-empty__empty']}
      />
      {description && (
        <Paragraph type="secondary" className={styles['feature-empty__description']}>
          {description}
        </Paragraph>
      )}
      {hints && hints.length > 0 && (
        <div className={styles['feature-empty__hints']}>
          {hints.map((hint, i) => (
            <div key={i} className={styles['feature-empty__hint-item']}>
              <span className={styles['feature-empty__hint-dot']} />
              <Text type="secondary" className={styles['feature-empty__hint-text']}>
                {hint}
              </Text>
            </div>
          ))}
        </div>
      )}
      {actions && actions.length > 0 && (
        <div className={styles['feature-empty__actions']}>
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
