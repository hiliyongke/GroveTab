/**
 * PanelErrorBoundary 单元测试
 *
 * 验证面板级错误边界的核心行为：
 *   1. 无错误时正常渲染子组件
 *   2. 子组件抛错时显示错误 UI
 *   3. 重试按钮可重置错误状态
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PanelErrorBoundary } from '@/shared/ui/PanelErrorBoundary';

// ── Mock 依赖 ──────────────────────────────────────

// Mock i18n hook — 返回 key 本身作为翻译文本，便于断言
vi.mock('@/shared/i18n', () => ({
  useT: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (key === 'error.panelCrash' && params?.label) return `${params.label} crashed`;
      if (key === 'error.retry') return 'Retry';
      return key;
    },
  }),
}));

// Mock brand（避免加载环境变量）
vi.mock('@/shared/config/brand', () => ({
  BRAND: { logTag: '[GroveTab]', name: 'GroveTab' },
}));

// Suppress console.error from componentDidCatch in tests
let consoleSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  consoleSpy.mockRestore();
});

// ── Helper：会崩溃的组件 ──────────────────────────

function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Test error message');
  return <div data-testid="child-content">Child works</div>;
}

// ── Tests ──────────────────────────────────────────

describe('PanelErrorBoundary', () => {
  it('无错误时应正常渲染子组件', () => {
    render(
      <PanelErrorBoundary label="TestPanel">
        <ThrowingComponent shouldThrow={false} />
      </PanelErrorBoundary>,
    );

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByText('Child works')).toBeInTheDocument();
  });

  it('子组件抛错时应显示错误 UI', () => {
    // React error boundary 需要在完整渲染周期中捕获错误，
    // 因此我们不能在 render() 内直接条件抛错——需要分开渲染。
    render(
      <PanelErrorBoundary label="TestPanel">
        <ThrowingComponent shouldThrow={true} />
      </PanelErrorBoundary>,
    );

    // 应显示错误提示（antd Alert 自带 role="alert"，外层 wrapper 也有，故用 getAllByRole）
    expect(screen.getAllByRole('alert').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('TestPanel crashed')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
    // 子组件不应出现
    expect(screen.queryByTestId('child-content')).not.toBeInTheDocument();
  });

  it('点击重试按钮应重置错误状态并重新渲染子组件', () => {
    // 使用 state 控制是否抛错
    let shouldThrow = true;

    function ConditionalThrower() {
      if (shouldThrow) throw new Error('Boom');
      return <div data-testid="recovered">Recovered</div>;
    }

    const { rerender } = render(
      <PanelErrorBoundary label="TestPanel">
        <ConditionalThrower />
      </PanelErrorBoundary>,
    );

    // 错误状态
    expect(screen.getAllByRole('alert').length).toBeGreaterThanOrEqual(1);

    // 修复错误源
    shouldThrow = false;

    // 点击重试
    fireEvent.click(screen.getByText('Retry'));

    // 此时 PanelErrorBoundary 内部 state 重置为 hasError=false，
    // 但子组件是同一个 ConditionalThrower 实例——React 会重新尝试渲染。
    // shouldThrow 已经为 false，所以子组件正常渲染。
    expect(screen.getByTestId('recovered')).toBeInTheDocument();
    expect(screen.queryAllByRole('alert')).toHaveLength(0);
  });

  it('不同 label 应在错误 UI 中展示对应面板名', () => {
    render(
      <PanelErrorBoundary label="Settings">
        <ThrowingComponent shouldThrow={true} />
      </PanelErrorBoundary>,
    );

    expect(screen.getByText('Settings crashed')).toBeInTheDocument();
  });
});
