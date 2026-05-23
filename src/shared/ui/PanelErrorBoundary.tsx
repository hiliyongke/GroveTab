/**
 * PanelErrorBoundary — 面板级错误边界
 *
 * 为各个功能面板（设置、洞察、历史等）提供统一的错误捕获 UI。
 * 当单个面板崩溃时，仅该面板显示错误提示，不影响整体应用。
 *
 * 与顶层 ErrorBoundary 的区别：
 *   - 顶层：捕获整个 AppContent 的崩溃 → 全页白屏 + 重试
 *   - 面板级：仅捕获单个面板 → 面板内显示错误 + 重试
 */

import { Component, type ReactNode } from 'react';
import { Alert, Button } from 'antd';
import { BRAND } from '@/shared/config/brand';
import { useT } from '@/shared/i18n';

interface Props {
  /** 面板名称，用于错误日志和 UI 展示 */
  label: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/** 面板级错误边界内部实现 — Class 组件以支持 getDerivedStateFromError */
class PanelErrorBoundaryInner extends Component<Props & { t: (key: string, params?: Record<string, string | number>) => string }, State> {
  /**
   * @param props - 组件属性
   */
  constructor(props: Props & { t: (key: string) => string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  /**
   * 从错误中派生新状态
   * @param error - 捕获到的错误
   */
  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  /**
   * 捕获错误并记录日志
   * @param error - 捕获到的错误
   * @param info - 组件堆栈信息
   */
  override componentDidCatch(error: Error, info: { componentStack: string }): void {
    console.error(`${BRAND.logTag} PanelErrorBoundary (${this.props.label})`, error);
    console.error('Component stack:', info.componentStack);
  }

  /**
   * 重置错误状态
   */
  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div role="alert" style={{ padding: 16 }}>
          <Alert
            type="error"
            message={this.props.t('error.panelCrash', { label: this.props.label })}
            description={this.state.error?.message}
            showIcon
            action={
              <Button size="small" onClick={this.handleReset}>
                {this.props.t('error.retry')}
              </Button>
            }
          />
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * 面板级错误边界 — 包装组件，自动注入 i18n
 * @param root0 - 组件属性
 * @param root0.label - 面板名称
 * @param root0.children - 子元素
 */
export function PanelErrorBoundary({ label, children }: Props) {
  const { t } = useT();
  return (
    <PanelErrorBoundaryInner label={label} t={t}>
      {children}
    </PanelErrorBoundaryInner>
  );
}
