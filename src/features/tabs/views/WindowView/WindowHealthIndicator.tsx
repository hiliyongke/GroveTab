/**
 * WindowHealthIndicator - 窗口健康度指示器
 *
 * 功能：
 * 1. 计算窗口健康度评分（0-100）
 * 2. 评分维度：标签数量、重复标签比例、内存占用、闲置时间
 * 3. 显示健康度指示器（颜色：绿/黄/红）
 * 4. 点击显示详细分析和优化建议
 * 5. 支持一键优化
 */

import { useState, useMemo, useCallback } from "react";
import {
  Flex,
  Typography,
  Button,
  Modal,
  Progress,
  List,
  Tag,
  Tooltip,
  theme,
} from "antd";
import {
  Heart,
  AlertTriangle,
  CheckCircle,
  Zap,
  Copy,
  Clock,
  HardDrive,
  Layers,
} from "lucide-react";
import { useT } from "@/shared/i18n";

// 安全翻译函数，确保返回字符串
function useSafeT() {
  const { t } = useT();
  return (key: string, params?: Record<string, string | number>) => {
    const result = t(key, params);
    return (result as string) || key;
  };
}
import type { LiveTab } from "@/shared/types";
import styles from "./WindowHealthIndicator.module.less";

interface WindowHealthIndicatorProps {
  windowId: number;
  tabs: LiveTab[];
  onOptimize?: (action: string, tabIds: number[]) => void;
}

interface HealthMetrics {
  score: number;
  status: "good" | "warning" | "critical";
  tabCount: number;
  duplicateCount: number;
  duplicateRatio: number;
  estimatedMemory: number; // MB
  idleTabs: number;
  issues: HealthIssue[];
}

interface HealthIssue {
  type: "duplicate" | "idle" | "memory" | "count";
  severity: "low" | "medium" | "high";
  message: string;
  affectedTabs: number[];
  suggestion: string;
}

// 估算内存占用（简化模型）
function estimateMemoryUsage(tab: LiveTab): number {
  let base = 80; // 基础 80MB

  // 根据 URL 特征调整
  const url = tab.url.toLowerCase();
  if (url.includes("youtube") || url.includes("video")) {
    base += 300; // 视频页面
  } else if (url.includes("image") || url.includes("photo")) {
    base += 150; // 图片页面
  } else if (url.includes("docs.google") || url.includes("office")) {
    base += 200; // 文档应用
  }

  // 根据标签状态调整
  if (tab.discarded) {
    base *= 0.1; // 休眠标签
  }

  return Math.round(base);
}

export function WindowHealthIndicator({
  tabs,
  onOptimize,
}: WindowHealthIndicatorProps) {
  const t = useSafeT();
  const { token } = theme.useToken();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 计算健康度指标
  const metrics = useMemo<HealthMetrics>(() => {
    const issues: HealthIssue[] = [];

    // 1. 标签数量检查
    const tabCount = tabs.length;
    if (tabCount > 50) {
      issues.push({
        type: "count",
        severity: "high",
        message: t("health.issues.tooManyTabs", { count: tabCount }),
        affectedTabs: tabs.map((t) => t.id),
        suggestion: t("health.suggestions.archiveOld"),
      });
    } else if (tabCount > 20) {
      issues.push({
        type: "count",
        severity: "medium",
        message: t("health.issues.manyTabs", { count: tabCount }),
        affectedTabs: tabs.map((t) => t.id),
        suggestion: t("health.suggestions.groupTabs"),
      });
    }

    // 2. 重复标签检查
    const urlMap = new Map<string, number[]>();
    tabs.forEach((tab) => {
      const normalizedUrl: string = tab.url.replace(/^https?:\/\//, "").split("?")[0] ?? "";
      const existing = urlMap.get(normalizedUrl) || [];
      existing.push(tab.id);
      urlMap.set(normalizedUrl, existing);
    });

    const duplicateGroups = Array.from(urlMap.entries()).filter(
      ([_, ids]) => ids.length > 1
    );
    const duplicateCount = duplicateGroups.reduce(
      (sum, [_, ids]) => sum + ids.length,
      0
    );
    const duplicateRatio = tabCount > 0 ? duplicateCount / tabCount : 0;

    if (duplicateRatio > 0.3) {
      issues.push({
        type: "duplicate",
        severity: "high",
        message: t("health.issues.manyDuplicates", {
          count: String(duplicateCount),
          percent: String(Math.round(duplicateRatio * 100)),
        }),
        affectedTabs: duplicateGroups.flatMap(([, ids]) => ids),
        suggestion: t("health.suggestions.closeDuplicates"),
      });
    } else if (duplicateRatio > 0.1) {
      issues.push({
        type: "duplicate",
        severity: "medium",
        message: t("health.issues.someDuplicates", {
          count: String(duplicateCount),
        }),
        affectedTabs: duplicateGroups.flatMap(([, ids]) => ids),
        suggestion: t("health.suggestions.closeDuplicates"),
      });
    }

    // 3. 内存占用检查
    const estimatedMemory = tabs.reduce(
      (sum, tab) => sum + estimateMemoryUsage(tab),
      0
    );
    const memoryPerTab = tabCount > 0 ? estimatedMemory / tabCount : 0;

    if (memoryPerTab > 300) {
      issues.push({
        type: "memory",
        severity: "high",
        message: t("health.issues.highMemory", { mb: estimatedMemory }),
        affectedTabs: tabs.filter((t) => !t.discarded).map((t) => t.id),
        suggestion: t("health.suggestions.discardInactive"),
      });
    } else if (memoryPerTab > 200) {
      issues.push({
        type: "memory",
        severity: "medium",
        message: t("health.issues.elevatedMemory", { mb: estimatedMemory }),
        affectedTabs: tabs.filter((t) => !t.discarded).map((t) => t.id),
        suggestion: t("health.suggestions.discardInactive"),
      });
    }

    // 4. 闲置标签检查
    const now = Date.now();
    const idleThreshold = 30 * 60 * 1000; // 30 分钟
    const idleTabs = tabs.filter(
      (tab) =>
        tab.lastAccessed && now - tab.lastAccessed > idleThreshold && !tab.discarded
    ).length;

    if (idleTabs > 10) {
      issues.push({
        type: "idle",
        severity: "medium",
        message: t("health.issues.manyIdle", { count: idleTabs }),
        affectedTabs: tabs
          .filter(
            (tab) =>
              tab.lastAccessed &&
              now - tab.lastAccessed > idleThreshold &&
              !tab.discarded
          )
          .map((t) => t.id),
        suggestion: t("health.suggestions.discardInactive"),
      });
    }

    // 计算总分（100分制）
    let score = 100;
    issues.forEach((issue) => {
      if (issue.severity === "high") score -= 25;
      else if (issue.severity === "medium") score -= 15;
      else score -= 5;
    });
    score = Math.max(0, Math.min(100, score));

    // 确定状态
    let status: "good" | "warning" | "critical";
    if (score >= 80) status = "good";
    else if (score >= 50) status = "warning";
    else status = "critical";

    return {
      score,
      status,
      tabCount,
      duplicateCount,
      duplicateRatio,
      estimatedMemory,
      idleTabs,
      issues,
    };
  }, [tabs, t]);

  // 获取状态颜色
  const getStatusColor = useCallback(
    (status: HealthMetrics["status"]) => {
      switch (status) {
        case "good":
          return token.colorSuccess;
        case "warning":
          return token.colorWarning;
        case "critical":
          return token.colorError;
        default:
          return token.colorSuccess;
      }
    },
    [token]
  );

  // 一键优化
  const handleOptimize = useCallback(
    (issue: HealthIssue) => {
      onOptimize?.(issue.type, issue.affectedTabs);
    },
    [onOptimize]
  );

  // 获取问题类型图标
  const getIssueIcon = useCallback(
    (type: HealthIssue["type"]) => {
      switch (type) {
        case "duplicate":
          return <Copy size={14} />;
        case "idle":
          return <Clock size={14} />;
        case "memory":
          return <HardDrive size={14} />;
        case "count":
          return <Layers size={14} />;
        default:
          return <AlertTriangle size={14} />;
      }
    },
    []
  );

  return (
    <>
      {/* 健康度指示器 */}
      <Tooltip
        title={
          <Flex vertical className={styles.tooltipWrap}>
            <Typography.Text strong>{t("health.tooltip.title")}</Typography.Text>
            <Typography.Text type="secondary" className={styles.tooltipScore}>
              {t("health.tooltip.score", { score: metrics.score })}
            </Typography.Text>
            {metrics.issues.length > 0 && (
              <>
                <Typography.Text
                  type="secondary"
                  className={styles.tooltipIssues}
                >
                  {t("health.tooltip.issues", { count: metrics.issues.length })}
                </Typography.Text>
                <List
                  size="small"
                  dataSource={metrics.issues.slice(0, 3)}
                  renderItem={(issue) => (
                    <List.Item className={styles.tooltipIssueItem}>
                      <Typography.Text type="danger">•</Typography.Text>{" "}
                      {issue.message}
                    </List.Item>
                  )}
                />
              </>
            )}
          </Flex>
        }
      >
        <Button
          type="text"
          size="small"
          icon={
            <Heart
              size={14}
              style={{
                color: getStatusColor(metrics.status),
              }}
            />
          }
          onClick={() => setIsModalOpen(true)}
          className={styles.healthButton}
          style={{
            color: getStatusColor(metrics.status),
          }}
        >
          {metrics.score}
        </Button>
      </Tooltip>

      {/* 健康度详情弹窗 */}
      <Modal
        title={
          <Flex align="center" gap={8}>
            <Heart size={18} style={{ color: getStatusColor(metrics.status) }} />
            <span>{t("health.modal.title")}</span>
          </Flex>
        }
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={480}
      >
        <Flex vertical gap={16} className={styles.modalBody}>
          {/* 总评分 */}
          <Flex align="center" gap={16}>
            <Progress
              type="circle"
              percent={metrics.score}
              size={80}
              strokeColor={getStatusColor(metrics.status)}
              format={(percent) => (
                <span className={styles.scoreText}>{percent}</span>
              )}
            />
            <Flex vertical>
              <Typography.Text strong className={styles.statusText}>
                {metrics.status === "good"
                  ? t("health.status.good")
                  : metrics.status === "warning"
                  ? t("health.status.warning")
                  : t("health.status.critical")}
              </Typography.Text>
              <Typography.Text type="secondary" className={styles.summaryText}>
                {t("health.summary", {
                  tabs: metrics.tabCount,
                  memory: metrics.estimatedMemory,
                })}
              </Typography.Text>
            </Flex>
          </Flex>

          {/* 问题列表 */}
          {metrics.issues.length > 0 && (
            <>
              <Typography.Text strong className={styles.issuesTitle}>
                {t("health.issues.title")}
              </Typography.Text>
              <List
                dataSource={metrics.issues}
                renderItem={(issue) => (
                  <List.Item
                    actions={[
                      <Button
                        key="optimize"
                        type="primary"
                        size="small"
                        icon={<Zap size={12} />}
                        onClick={() => handleOptimize(issue)}
                        danger={issue.severity === "high"}
                      >
                        {t("health.optimize")}
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        <div
                          style={{
                            color:
                              issue.severity === "high"
                                ? token.colorError
                                : issue.severity === "medium"
                                ? token.colorWarning
                                : token.colorInfo,
                          }}
                        >
                          {getIssueIcon(issue.type)}
                        </div>
                      }
                      title={
                        <Flex align="center" gap={8}>
                          <span>{issue.message}</span>
                          <Tag
                            color={
                              issue.severity === "high"
                                ? "error"
                                : issue.severity === "medium"
                                ? "warning"
                                : "default"
                            }
                            className={styles.severityTag}
                          >
                            {t(`health.severity.${issue.severity}`)}
                          </Tag>
                        </Flex>
                      }
                      description={issue.suggestion}
                    />
                  </List.Item>
                )}
              />
            </>
          )}

          {metrics.issues.length === 0 && (
            <Flex vertical align="center" style={{ padding: 32 }}>
              <CheckCircle size={48} style={{ color: token.colorSuccess }} />
              <Typography.Text type="success" style={{ marginTop: 16 }}>
                {t("health.allGood")}
              </Typography.Text>
            </Flex>
          )}
        </Flex>
      </Modal>
    </>
  );
}
