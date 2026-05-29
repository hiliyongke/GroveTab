import { Button, Tooltip } from "antd";
import { Pin, PinOff } from "lucide-react";
import { useSmartSortStore } from "@/store";
import styles from "../styles/smart-sort.module.less";

interface PinButtonProps {
  tabId: number;
  size?: "small" | "middle" | "large";
}

/** 置顶/取消置顶按钮 */
export function PinButton({ tabId, size = "small" }: PinButtonProps) {
  const pinnedTabIds = useSmartSortStore((s) => s.pinnedTabIds);
  const togglePinnedTab = useSmartSortStore((s) => s.togglePinnedTab);
  const isPinned = pinnedTabIds.includes(tabId);

  const handleToggle = () => {
    togglePinnedTab(tabId);
  };

  return (
    <Tooltip title={isPinned ? "取消置顶" : "置顶标签"}>
      <Button
        type="text"
        size={size}
        icon={isPinned ? <Pin size={14} /> : <PinOff size={14} />}
        className={`${styles.pinButton} ${isPinned ? styles.pinned : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          handleToggle();
        }}
      />
    </Tooltip>
  );
}
