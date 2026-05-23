/**
 * BaseCard —— 基础卡片组件
 *
 * 统一项目内所有卡片的样式和行为。
 * 封装 antd Card 组件，提供：
 *   - hover 上浮效果
 *   - 自定义边框和阴影
 *   - 支持 disabled 状态
 *   - 支持 loading 状态
 *   - 支持自定义 classNames 和 styles
 *
 * 设计原则：
 *   1. 最小 API   —— 仅暴露必要的 props
 *   2. 样式隔离 —— 使用 CSS Modules
 *   3. 行为一致 —— 所有卡片交互统一
 *   4. 可扩展性 —— 支持通过 classNames 覆盖
 */

import { Card, type CardProps } from 'antd';
import { theme } from 'antd';
import styles from './BaseCard.module.less';

export interface BaseCardProps extends Omit<CardProps, 'classNames' | 'style'> {
  /** 是否可 hover（显示上浮效果） */
  hoverable?: boolean;
  /** 自定义根元素类名 */
  className?: string;
  /** 自定义内容区域类名 */
  bodyClassName?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否加载中 */
  loading?: boolean;
}

/**
 * 基础卡片组件
 *
 * @param props - 组件属性
 * @param props.hoverable   - 是否可 hover
 * @param props.className   - 根元素类名
 * @param props.bodyClassName - 内容区域类名
 * @param props.style        - 自定义样式
 * @param props.disabled    - 是否禁用
 * @param props.loading     - 是否加载中
 * @param props.children    - 子元素
 * @returns 卡片组件
 */
export function BaseCard({
  hoverable = false,
  className = '',
  bodyClassName = '',
  style,
  disabled = false,
  loading = false,
  children,
  ...cardProps
}: BaseCardProps) {
  const { token } = theme.useToken();

  const cardStyle: React.CSSProperties = {
    ...style,
    ...(hoverable && {
      cursor: 'pointer',
      transition: `all ${token.motionDurationMid} ${token.motionEaseInOut}`,
      ':hover': {
        transform: `translateY(-${token.controlHeightXS}px)`,
        boxShadow: token.boxShadowTertiary,
      },
    }),
    ...(disabled && {
      cursor: 'not-allowed',
      opacity: 0.5,
    }),
  };

  return (
    <Card
      loading={loading}
      className={`${styles['base-card']} ${className}`}
      classNames={{
        body: `${styles['base-card__body']} ${bodyClassName}`,
      }}
      style={cardStyle}
      {...cardProps}
    >
      {children}
    </Card>
  );
}
