/**
 * ErrorBoundary —— 捕获渲染过程中的错误，输出组件堆栈以便定位问题
 */
import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  label?: string;
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
      `[Canopy ErrorBoundary${this.props.label ? ` (${this.props.label})` : ''}]`,
      error,
    );
    console.error('Component stack:', info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, color: 'red' }}>
          <h3>Something went wrong{this.props.label ? ` in ${this.props.label}` : ''}</h3>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
