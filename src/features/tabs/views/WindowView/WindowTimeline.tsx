/**
 * WindowTimeline - 窗口时间线回溯组件
 *
 * 功能：
 * 1. 展示窗口内标签的打开/关闭历史
 * 2. 支持按时间范围筛选（今天、昨天、7天）
 * 3. 支持恢复已关闭的标签
 */

import { useState, useMemo, useCallback } from "react";
import { Flex, Typography, Button, Timeline, Tag, Segmented, Tooltip, theme } from "antd";
import { Clock, RotateCcw, Globe, X, History } from "lucide-react";
import { useT } from "@/shared/i18n";
import { createTab } from "@/chrome";
import type { LiveTab } from "@/shared/types";
import styles from "./WindowTimeline.module.less";

type TimeRange = "today" | "yesterday" | "week";

interface TimelineEvent {
  id: string;
  type: "opened" | "closed" | "activated";
  tabId: number;
  title: string;
  url: string;
  timestamp: number;
}

interface WindowTimelineProps {
  windowId: number;
  tabs: LiveTab[];
  closedTabs?: Array<{
    tabId: number;
    title: string;
    url: string;
    closedAt: number;
  }>;
}

export function WindowTimeline({ windowId, tabs, closedTabs = [] }: WindowTimelineProps) {
  const { t } = useT();
  const { token } = theme.useToken();
  const [timeRange, setTimeRange] = useState<TimeRange>("today");

  // 根据时间范围筛选事件
  const filteredEvents = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    let cutoffTime: number;
    switch (timeRange) {
      case "today":
        cutoffTime = startOfToday.getTime();
        break;
      case "yesterday":
        cutoffTime = startOfToday.getTime() - 24 * 60 * 60 * 1000;
        break;
      case "week":
        cutoffTime = startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000;
        break;
      default:
        cutoffTime = startOfToday.getTime();
    }

    const events: TimelineEvent[] = [];

    // 添加打开的标签事件
    tabs.forEach((tab) => {
      if (tab.lastAccessed && tab.lastAccessed >= cutoffTime) {
        events.push({
          id: `opened-${tab.id}`,
          type: "opened",
          tabId: tab.id,
          title: tab.title || t("unnamedTab"),
          url: tab.url,
          timestamp: tab.lastAccessed,
        });
      }
    });

    // 添加关闭的标签事件
    closedTabs.forEach((closedTab) => {
      if (closedTab.closedAt >= cutoffTime) {
        events.push({
          id: `closed-${closedTab.tabId}`,
          type: "closed",
          tabId: closedTab.tabId,
          title: closedTab.title,
          url: closedTab.url,
          timestamp: closedTab.closedAt,
        });
      }
    });

    // 按时间倒序排列
    return events.sort((a, b) => b.timestamp - a.timestamp);
  }, [tabs, closedTabs, timeRange, t]);

  // 恢复已关闭的标签
  const handleRestore = useCallback(
    async (url: string) => {
      try {
        await createTab({ url, windowId });
      } catch (err) {
        console.error("Failed to restore tab:", err);
      }
    },
    [windowId]
  );

  // 格式化时间
  const formatTime = useCallback(
    (timestamp: number) => {
      const date = new Date(timestamp);
      const hours = date.getHours().toString().padStart(2, "0");
      const minutes = date.getMinutes().toString().padStart(2, "0");
      return `${hours}:${minutes}`;
    },
    []
  );

  // 获取事件类型标签
  const getEventTag = useCallback(
    (type: TimelineEvent["type"]) => {
      switch (type) {
        case "opened":
          return (
            <Tag color="success" style={{ fontSize: 11 }}>
              {t("timeline.opened")}
            </Tag>
          );
        case "closed":
          return (
            <Tag color="error" style={{ fontSize: 11 }}>
              {t("timeline.closed")}
            </Tag>
          );
        case "activated":
          return (
            <Tag color="processing" style={{ fontSize: 11 }}>
              {t("timeline.activated")}
            </Tag>
          );
        default:
          return null;
      }
    },
    [t]
  );

  if (filteredEvents.length === 0) {
    return (
      <Flex vertical align="center" justify="center" className={styles.empty}>
        <History size={48} color={token.colorTextTertiary} />
        <Typography.Text type="secondary" style={{ marginTop: 16 }}>
          {t("timeline.noEvents")}
        </Typography.Text>
      </Flex>
    );
  }

  return (
    <Flex vertical className={styles.windowTimeline}>
      {/* 时间范围选择 */}
      <Flex justify="space-between" align="center" className={styles.header}>
        <Typography.Text strong>{t("timeline.title")}</Typography.Text>
        <Segmented
          value={timeRange}
          onChange={(value) => setTimeRange(value as TimeRange)}
          options={[
            { label: t("timeline.today"), value: "today" },
            { label: t("timeline.yesterday"), value: "yesterday" },
            { label: t("timeline.week"), value: "week" },
          ]}
          size="small"
        />
      </Flex>

      {/* 时间线 */}
      <div className={styles.timelineContainer}>
        <Timeline mode="left">
          {filteredEvents.map((event) => (
            <Timeline.Item
              key={event.id}
              label={
                <span className={styles.timeLabel}>{formatTime(event.timestamp)}</span>
              }
              dot={
                event.type === "closed" ? (
                  <X size={12} style={{ color: token.colorError }} />
                ) : (
                  <Clock size={12} style={{ color: token.colorSuccess }} />
                )
              }
            >
              <Flex vertical className={styles.eventCard}>
                <Flex justify="space-between" align="center">
                  <Flex align="center" gap={8}>
                    <Globe size={14} color={token.colorTextTertiary} />
                    <Typography.Text
                      strong
                      ellipsis
                      style={{ maxWidth: 200, fontSize: 13 }}
                      title={event.title}
                    >
                      {event.title}
                    </Typography.Text>
                  </Flex>
                  {getEventTag(event.type)}
                </Flex>

                <Typography.Text
                  type="secondary"
                  ellipsis
                  style={{ fontSize: 11, marginTop: 4 }}
                  title={event.url}
                >
                  {event.url.replace(/^https?:\/\//, "").slice(0, 60)}
                </Typography.Text>

                {event.type === "closed" && (
                  <Flex justify="flex-end" style={{ marginTop: 8 }}>
                    <Tooltip title={t("timeline.restore")}>
                      <Button
                        type="link"
                        size="small"
                        icon={<RotateCcw size={12} />}
                        onClick={() => handleRestore(event.url)}
                        style={{ fontSize: 12, padding: 0 }}
                      >
                        {t("timeline.restore")}
                      </Button>
                    </Tooltip>
                  </Flex>
                )}
              </Flex>
            </Timeline.Item>
          ))}
        </Timeline>
      </div>
    </Flex>
  );
}
