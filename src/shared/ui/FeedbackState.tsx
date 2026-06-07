import { type ReactNode } from "react";
import { Spin, Button, Result } from "antd";
import { RefreshCw } from "lucide-react";
import { FeatureEmptyState } from "./FeatureEmptyState";
import { useT } from "@/shared/i18n";
import styles from "./FeedbackState.module.less";

export interface FeedbackStateProps {
  /** 是否加载中 */
  loading?: boolean;
  /** 加载文案（默认 "加载中..."） */
  loadingText?: string;
  /** 是否有错误 */
  error?: Error | string | null;
  /** 错误标题 */
  errorTitle?: string;
  /** 重试回调 */
  onRetry?: () => void;
  /** 是否为空 */
  empty?: boolean;
  /** 空状态标题 */
  emptyTitle?: string;
  /** 空状态描述 */
  emptyDescription?: string;
  /** 空状态图标 */
  emptyIcon?: ReactNode;
  /** 空状态操作按钮 */
  emptyActions?: Array<{
    text: string;
    onClick: () => void;
    type?: "primary" | "default" | "dashed" | "link";
  }>;
  /** 空状态提示列表 */
  emptyHints?: string[];
  /** 正常内容 */
  children?: ReactNode;
}

export function FeedbackState({
  loading = false,
  loadingText,
  error,
  errorTitle,
  onRetry,
  empty = false,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  emptyActions,
  emptyHints,
  children,
}: FeedbackStateProps) {
  const { t } = useT();
  // 加载态
  if (loading) {
    return (
      <div className={styles["loading-container"]}>
        <Spin size="large" />
        {loadingText && <div className={styles["loading-text"]}>{loadingText}</div>}
      </div>
    );
  }

  // 错误态
  if (error) {
    const errorMessage = typeof error === "string" ? error : error.message;
    return (
      <Result
        status="error"
        title={errorTitle || t("出错了")}
        subTitle={errorMessage}
        extra={
          onRetry && (
            <Button type="primary" onClick={onRetry} icon={<RefreshCw size={16} />}>
              {t("重试")}
            </Button>
          )
        }
      />
    );
  }

  // 空态
  if (empty) {
    return (
      <FeatureEmptyState
        title={emptyTitle || t("暂无数据")}
        description={emptyDescription}
        icon={emptyIcon}
        actions={emptyActions}
        hints={emptyHints}
      />
    );
  }

  // 正常内容
  return <>{children}</>;
}
