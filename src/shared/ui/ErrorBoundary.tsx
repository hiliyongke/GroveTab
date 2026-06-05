/**
 * ErrorBoundary — 错误边界，支持自定义 fallback 和 onReset 重试。
 */
import { Component, type ReactNode } from "react";
import { Button } from "antd";
import { BRAND } from "@/shared/config/brand";
import styles from "./status-surfaces.module.less";

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
      `${BRAND.logTag} ErrorBoundary${this.props.label ? ` (${this.props.label})` : ""}`,
      error,
    );
    console.error("Component stack:", info.componentStack);
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
        <div role="alert" className={styles["app-error-boundary"]}>
          <div className={styles["app-error-boundary__title"]}>
            加载失败{this.props.label ? ` · ${this.props.label}` : ""}
          </div>
          <div className={styles["app-error-boundary__message"]}>{this.state.error.message}</div>
          <Button
            type="primary"
            onClick={this.reset}
            className={styles["app-error-boundary__retry"]}
          >
            点击重试
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
