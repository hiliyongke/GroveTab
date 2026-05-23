/**
 * ErrorBoundary · v1.3
 *
 * 变更：
 *  - 支持 `fallback`：自定义错误态 UI（替换默认技术栈打印）
 *  - 支持 `onReset`：允许外部重试（典型使用：Widget 内部网络调用失败，
 *    用户点击后重置 error state 再渲染 children）
 *  - 默认 UI：紧凑"加载失败 · 点击重试"占位，适合单个 Widget 卡片
 */
import { Component, type ReactNode } from 'react';
import { Button } from 'antd';
import { BRAND } from '@/shared/config/brand';
import styles from './status-surfaces.module.less';

interface Props {
  /** 子组件（需要错误边界包裹的内容） */
  children: ReactNode;
  /** 可选：错误来源标签，用于错误日志区分（如 "WidgetA"） */
  label?: string;
  /** 可选：自定义 fallback UI；传入时优先于默认占位 */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** 可选：用户点击"重试"时附加的回调（例如重新拉取数据） */
  onReset?: () => void;
}

interface State {
  /** 是否捕获到错误 */
  hasError: boolean;
  /** 捕获到的错误对象（为 null 时表示无错误） */
  error: Error | null;
}

/**
 * 错误边界组件 —— 捕获子组件树中的渲染错误，展示兜底 UI。
 *
 * 设计：
 *   - 支持 `fallback` 自定义错误态 UI
 *   - 支持 `onReset` 外部重试回调
 *   - 默认 UI 为紧凑型"加载失败 · 点击重试"占位
 */
export class ErrorBoundary extends Component<Props, State> {
  /**
   * 构造函数：初始化错误状态
   * @param props 组件属性
   */
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  /**
   * 渲染阶段捕获错误后，更新 state 触发兜底 UI
   * @param error 捕获到的错误对象
   * @returns 部分 state 更新（hasError + error）
   */
  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  /**
   * 捕获渲染错误后的副作用：打印错误日志与组件堆栈
   *
   * @param error 捕获到的错误对象
   * @param info 包含 componentStack 的错误上下文信息
   * @param info.componentStack
   */
  override componentDidCatch(error: Error, info: { componentStack: string }): void {
    console.error(
      `${BRAND.logTag} ErrorBoundary${this.props.label ? ` (${this.props.label})` : ''}`,
      error,
    );
    console.error('Component stack:', info.componentStack);
  }

  /** 重置错误状态，并触发外部 onReset 回调 */
  private reset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  /**
   * 渲染函数：根据错误状态决定展示兜底 UI 还是子组件
   *
   * @returns 错误时返回兜底 UI，否则返回子组件
   */
  override render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      // 优先使用调用方提供的 fallback
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return (
        <div role="alert" className={styles['app-error-boundary']}>
          <div className={styles['app-error-boundary__title']}>
            加载失败{this.props.label ? ` · ${this.props.label}` : ''}
          </div>
          <div className={styles['app-error-boundary__message']}>
            {this.state.error.message}
          </div>
          <Button
            type="text"
            onClick={this.reset}
            className={styles['app-error-boundary__retry']}
          >
            点击重试
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
