import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Button, Flex, Typography } from "antd";
import { RefreshCw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[Popup ErrorBoundary]", error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            padding: 32,
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            gap: 16,
          }}
        >
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            出了点问题，请尝试重试
          </Typography.Text>
          {import.meta.env.DEV && this.state.error && (
            <Typography.Text
              type="secondary"
              style={{ fontSize: 11, maxWidth: 280, wordBreak: "break-all" }}
            >
              {this.state.error.message}
            </Typography.Text>
          )}
          <Flex gap={8}>
            <Button
              size="small"
              icon={<RefreshCw size={14} />}
              onClick={this.handleRetry}
            >
              点击重试
            </Button>
            <Button
              size="small"
              onClick={() => {
                if (typeof window !== "undefined") window.close();
              }}
            >
              关闭弹窗
            </Button>
          </Flex>
        </div>
      );
    }
    return this.props.children;
  }
}
