import { Segmented, Tooltip, Flex } from "antd";
import { Clock, TrendingUp, Timer, Pin, ArrowUpDown } from "lucide-react";
import type { SortMode } from "../types";
import styles from "../styles/smart-sort.module.less";

interface SmartSortToolbarProps {
  /** 当前排序模式 */
  mode: SortMode;
  /** 切换排序模式 */
  onModeChange: (mode: SortMode) => void;
}

/** 排序规则定义 */
const SORT_RULES = [
  { value: "default" as SortMode, label: "默认", icon: <ArrowUpDown size={14} /> },
  { value: "recency" as SortMode, label: "最近访问", icon: <Clock size={14} /> },
  { value: "frequency" as SortMode, label: "使用频率", icon: <TrendingUp size={14} /> },
  { value: "time" as SortMode, label: "停留时长", icon: <Timer size={14} /> },
  { value: "manual" as SortMode, label: "手动置顶", icon: <Pin size={14} /> },
];

/** 智能排序工具栏 - 明确的排序规则选择 */
export function SmartSortToolbar({ mode, onModeChange }: SmartSortToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <Flex gap="small" align="center" className={styles.controlRow}>
        {/* 排序规则选择器 */}
        <Segmented
          value={mode}
          onChange={(value) => onModeChange(value as SortMode)}
          options={SORT_RULES.map((rule) => ({
            value: rule.value,
            label: (
              <Tooltip title={getRuleTooltip(rule.value)} placement="top">
                <Flex gap={4} align="center" justify="center">
                  {rule.icon}
                  <span>{rule.label}</span>
                </Flex>
              </Tooltip>
            ),
          }))}
          size="small"
          className={styles.ruleSelector}
        />
      </Flex>
    </div>
  );
}

/** 获取排序规则的提示文本 */
function getRuleTooltip(mode: SortMode): string {
  switch (mode) {
    case "default":
      return "按标签原始顺序排列";
    case "recency":
      return "最近访问的标签排在前面";
    case "frequency":
      return "访问次数多的标签排在前面";
    case "time":
      return "累计停留时间长的标签排在前面";
    case "manual":
      return "手动置顶的标签排在最前面";
    default:
      return "";
  }
}
