/**
 * useTabGroupActions — Tab Group 操作逻辑 hook
 *
 * 从 TabGroupCard 中提取的分组操作逻辑：
 *   - 重命名（inline Input + updateTabGroup）
 *   - 换颜色（9 色选择器 + updateTabGroup）
 *   - 解散分组（ungroupTabs + swBroadcast）
 *   - 休眠组内标签（discardTab × N）
 *   - 移动到新窗口（createWindowWithTab + moveTabs + groupTabs）
 *   - 关闭分组（feedback.modal.confirm + closeTabs）
 */

import { useState } from "react";
import {
  updateTabGroup,
  ungroupTabs,
  closeTabs,
  discardTab,
  createWindowWithTab,
  moveTabs,
  groupTabs,
} from "@/chrome";
import type { ChromeTabGroupColor } from "@/chrome";
import { swBroadcast } from "@/shared/utils/sw-broadcast";
import { feedback } from "@/shared/ui/feedback";
import { useT } from "@/shared/i18n";
import type { TabGroupData } from "../components/TabGroupCard";

interface UseTabGroupActionsOptions {
  group: TabGroupData;
}

export function useTabGroupActions({ group }: UseTabGroupActionsOptions) {
  const { t } = useT();
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState(group.title);
  const [busy, setBusy] = useState(false);

  const isUngrouped = group.groupId === -1;

  const runGroupAction = async (action: () => Promise<void>, successKey?: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      if (successKey) feedback.success(successKey);
    } catch (err) {
      feedback.error(t("操作失败，请重试"), err);
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async () => {
    if (isUngrouped) return;
    const nextTitle = titleDraft.trim();
    await runGroupAction(async () => {
      const g = await updateTabGroup(group.groupId, { title: nextTitle });
      swBroadcast("tab-group-updated", {
        id: g.id,
        title: g.title,
        color: g.color,
        collapsed: g.collapsed,
        windowId: g.windowId,
      });
      setRenaming(false);
    }, t("已重命名"));
  };

  const handleColorChange = (nextColor: ChromeTabGroupColor) => {
    if (isUngrouped) return;
    void runGroupAction(async () => {
      const g = await updateTabGroup(group.groupId, { color: nextColor });
      swBroadcast("tab-group-updated", {
        id: g.id,
        title: g.title,
        color: g.color,
        collapsed: g.collapsed,
        windowId: g.windowId,
      });
    }, t("颜色已更改"));
  };

  const handleUngroup = () => {
    if (isUngrouped) return;
    void runGroupAction(async () => {
      await ungroupTabs(group.tabs.map((tab) => tab.id));
      swBroadcast("tab-ungrouped", { groupId: group.groupId, windowId: group.windowId });
    }, t("已解除分组"));
  };

  const handleCloseGroup = () => {
    feedback.modal.confirm({
      title: t("确认关闭分组"),
      content: t("确定要关闭这 {count} 个标签页吗？", { count: group.tabs.length }),
      okButtonProps: { danger: true },
      onOk: () =>
        runGroupAction(async () => {
          await closeTabs(group.tabs.map((tab) => tab.id));
        }, t("已关闭分组")),
    });
  };

  const handleDiscardGroup = () => {
    void runGroupAction(async () => {
      await Promise.all(
        group.tabs.filter((tab) => !tab.discarded).map((tab) => discardTab(tab.id)),
      );
    }, t("已休眠分组"));
  };

  const handleMoveToNewWindow = () => {
    void runGroupAction(async () => {
      const [firstTab, ...restTabs] = group.tabs;
      if (!firstTab) return;
      const newWindow = await createWindowWithTab(firstTab.id);
      if (!newWindow.id) throw new Error("new window has no id");
      if (restTabs.length > 0) {
        await moveTabs(
          restTabs.map((tab) => tab.id),
          newWindow.id,
          -1,
        );
      }
      if (!isUngrouped) {
        const movedTabIds = group.tabs.map((tab) => tab.id);
        const nextGroupId = await groupTabs({
          tabIds: movedTabIds,
          createProperties: { windowId: newWindow.id },
        });
        const g = await updateTabGroup(nextGroupId, {
          title: group.title,
          color: group.color,
          collapsed: group.collapsed,
        });
        swBroadcast("tab-group-updated", {
          id: g.id,
          title: g.title,
          color: g.color,
          collapsed: g.collapsed,
          windowId: g.windowId,
        });
      }
    }, t("已移至新窗口"));
  };

  const startRename = () => {
    setTitleDraft(group.title);
    setRenaming(true);
  };

  return {
    renaming,
    titleDraft,
    setTitleDraft,
    busy,
    startRename,
    handleRename,
    handleColorChange,
    handleUngroup,
    handleCloseGroup,
    handleDiscardGroup,
    handleMoveToNewWindow,
    isUngrouped,
  };
}
