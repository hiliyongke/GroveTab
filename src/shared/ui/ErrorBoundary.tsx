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
import { BRAND } from '@/shared/config/brand';

interface Props {
  children: ReactNode;
  label?: string;
  /** 可选：自定义 fallback UI；传入时优先于默认占位 */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** 可选：用户点击"重试"时附加的回调（例如重新拉取数据） */
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: { componentStack: string }): void {
    console.error(
      `${BRAND.logTag} ErrorBoundary${this.props.label ? ` (${this.props.label})` : ''}`,
      error,
    );
    console.error('Component stack:', info.componentStack);
  }

  private reset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  override render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      // 优先使用调用方提供的 fallback
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return (
        <div
          role="alert"
          style={{
            padding: 16,
            color: 'var(--ant-color-error-text, #cf1322)',
            background: 'var(--ant-color-error-bg, #fff2f0)',
            borderRadius: 8,
            fontSize: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            alignItems: 'flex-start',
          }}
        >
          <div style={{ fontWeight: 600 }}>
            加载失败{this.props.label ? ` · ${this.props.label}` : ''}
          </div>
          <div style={{ opacity: 0.8, wordBreak: 'break-word' }}>
            {this.state.error.message}
          </div>
          <button
            type="button"
            onClick={this.reset}
            style={{
              all: 'unset',
              cursor: 'pointer',
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid currentColor',
              fontSize: 11,
            }}
          >
            点击重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
