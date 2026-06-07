/**
 * InsightsHeader — 洞察面板头部
 *
 * 包含：子视图切换（数据分析 / 使用频率 / 智能整理）
 */

import { Segmented, Flex } from "antd";
import { useT } from "@/shared/i18n";

export type InsightsSubView = "analytics" | "frequency" | "tidy";

interface Props {
  value: InsightsSubView;
  onChange: (v: InsightsSubView) => void;
}

export function InsightsHeader({ value, onChange }: Props) {
  const { t } = useT();
  return (
    <Flex className="insights-header" role="tablist" aria-label={t("洞察子视图")}>
      <Segmented
        value={value}
        onChange={(v) => onChange(v as InsightsSubView)}
        options={[
          { label: t("数据分析"), value: "analytics" as const },
          { label: t("使用频率"), value: "frequency" as const },
          { label: t("智能整理"), value: "tidy" as const },
        ]}
      />
    </Flex>
  );
}
