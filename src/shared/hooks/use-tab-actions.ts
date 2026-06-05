/**
 * useTabActions — 统一的 Tab 操作 hook
 *
 * 集中管理 jumpToTab + closeSingleTab，减少 8 个组件的重复选择器。
 */
import { useTabsStore } from "@/store";

export function useTabActions() {
  const jumpToTab = useTabsStore((s) => s.jumpToTab);
  const closeSingleTab = useTabsStore((s) => s.closeSingleTab);
  return { jumpToTab, closeSingleTab };
}
