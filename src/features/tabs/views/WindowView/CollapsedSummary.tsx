/**
 * CollapsedSummary — 窗口折叠态增强摘要
 *
 * 替代原有的纯文本摘要，在折叠态显示：
 *   - 域名 Top3（带 favicon）+ 分组颜色条 + 最近活跃标签标题
 *   - 点击可展开
 *   - 折叠态高度不超过 80px
 */

import { useMemo, memo } from "react";
import { Flex, Typography, Tooltip } from "antd";
import { Globe } from "lucide-react";

import type { LiveTab } from "@/shared/types";
import { useT } from "@/shared/i18n";
import { stringToColor } from "@/shared/utils/color";
import styles from "@/features/tabs/styles/views.module.less";

interface CollapsedSummaryProps {
  tabs: LiveTab[];
  groupCount: number;
  onClick: () => void;
}

interface DomainEntry {
  hostname: string;
  count: number;
  favIconUrl: string;
}

/**
 * 计算域名 Top3（按标签数量排序）
 */
function computeDomainTop3(tabs: LiveTab[]): DomainEntry[] {
  const domainMap = new Map<string, { count: number; favIconUrl: string }>();
  for (const tab of tabs) {
    const domain = tab.hostname || "other";
    const existing = domainMap.get(domain);
    if (existing) {
      existing.count += 1;
    } else {
      domainMap.set(domain, {
        count: 1,
        favIconUrl: tab.favIconUrl || "",
      });
    }
  }
  return [...domainMap.entries()]
    .map(([hostname, { count, favIconUrl }]) => ({ hostname, count, favIconUrl }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

/**
 * 获取最近活跃标签标题
 */
function getLatestActiveTitle(tabs: LiveTab[]): string {
  const sorted = [...tabs].sort((a, b) => b.lastAccessed - a.lastAccessed);
  return sorted[0]?.title ?? "";
}

/**
 * 获取分组颜色列表
 */
function getGroupColors(tabs: LiveTab[]): string[] {
  const colors = new Set<string>();
  for (const tab of tabs) {
    if (tab.groupId !== -1 && tab.groupColor) {
      colors.add(tab.groupColor);
    }
  }
  return [...colors];
}

const GROUP_COLOR_HEX: Record<string, string> = {
  grey: "#8a8f98",
  blue: "#1a73e8",
  red: "#d93025",
  yellow: "#f9ab00",
  green: "#188038",
  pink: "#d01884",
  purple: "#9334e6",
  cyan: "#00acc1",
  orange: "#fa7b17",
};

export const CollapsedSummary = memo(function CollapsedSummary({
  tabs,
  groupCount,
  onClick,
}: CollapsedSummaryProps) {
  const { t } = useT();

  const domainTop3 = useMemo(() => computeDomainTop3(tabs), [tabs]);
  const latestTitle = useMemo(() => getLatestActiveTitle(tabs), [tabs]);
  const groupColors = useMemo(() => getGroupColors(tabs), [tabs]);

  return (
    <Flex
      align="center"
      gap={8}
      className={styles["app-window-collapsed-summary"]}
      onClick={onClick}
    >
      {/* 分组颜色条 */}
      {groupColors.length > 0 && (
        <Flex gap={2} className={styles["app-window-collapsed-colors"]}>
          {groupColors.map((color) => (
            <span
              key={color}
              className={styles["app-window-collapsed-color-dot"]}
              style={{ background: GROUP_COLOR_HEX[color] ?? stringToColor(color) }}
            />
          ))}
        </Flex>
      )}

      {/* 域名 Top3 */}
      <Flex align="center" gap={4} className={styles["app-window-collapsed-domains"]}>
        {domainTop3.map((entry) => (
          <Tooltip
            key={entry.hostname}
            title={`${entry.hostname} (${entry.count})`}
            mouseEnterDelay={0.3}
          >
            <Flex align="center" gap={2} className={styles["app-window-collapsed-domain"]}>
              {entry.favIconUrl ? (
                <img
                  src={entry.favIconUrl}
                  alt=""
                  width={12}
                  height={12}
                  className={styles["app-window-collapsed-domain-icon"]}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <Globe size={10} className={styles["app-window-collapsed-domain-fallback"]} />
              )}
              <Typography.Text className={styles["app-window-collapsed-domain-name"]}>
                {entry.hostname}
              </Typography.Text>
            </Flex>
          </Tooltip>
        ))}
      </Flex>

      {/* 标签数 + 分组数 */}
      <Typography.Text className={styles["app-window-collapsed-meta"]}>
        {t("window.summary", { count: tabs.length, groups: groupCount })}
      </Typography.Text>

      {/* 最近活跃标签标题 */}
      {latestTitle && (
        <Typography.Text className={styles["app-window-collapsed-active"]} ellipsis>
          {latestTitle}
        </Typography.Text>
      )}
    </Flex>
  );
});
