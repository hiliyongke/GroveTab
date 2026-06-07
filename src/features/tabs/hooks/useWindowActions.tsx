/**
 * useWindowActions — WindowCard 操作逻辑 hook
 *
 * 从 WindowCard 中提取的操作逻辑：
 *   - 窗口别名编辑（alias）
 *   - 合并到当前窗口（mergeToCurrent）
 *   - 将未分组标签创建为分组（createGroupFromUngrouped）
 *   - 关闭窗口（closeWindow，含确认弹窗）
 *   - 窗口贴边（snap）
 *   - 排列所有窗口（arrangeAllWindows）
 *   - Dropdown 菜单项构建
 */

import { useState, useMemo } from "react";
import type { MenuProps } from "antd";
import { Edit3, Merge, Plus, X } from "lucide-react";

import type { LiveTab } from "@/shared/types";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { CLOSE_CONFIRM_THRESHOLD } from "@/shared/types/settings";
import { useT } from "@/shared/i18n";
import { translate } from "@/shared/i18n/core";
import { feedback } from "@/shared/ui/feedback";
import {
  arrangeWindows,
  moveTabs,
  closeWindow,
  createTabGroup,
  snapWindow,
  type SplitLayout,
  type WindowSnapAction,
} from "@/chrome";
import { useMetadataStore, useSettingsStore, useTabsStore } from "@/store";
import { swBroadcast } from "@/shared/utils/sw-broadcast";

const BATCH = 10;

interface UseWindowActionsOptions {
  windowId: number;
  tabs: LiveTab[];
  isCurrent: boolean;
  isIncognito: boolean;
  ungroupedTabs: LiveTab[];
  onRefresh: () => void;
}

export function useWindowActions({
  windowId,
  tabs,
  isCurrent,
  isIncognito,
  ungroupedTabs,
  onRefresh,
}: UseWindowActionsOptions) {
  const { t } = useT();
  const alias = useMetadataStore((s) => s.windowAliases[windowId]);
  const setWindowAlias = useMetadataStore((s) => s.setWindowAlias);
  const closeConfirmThreshold = useSettingsStore(
    (s) => s.settings.closeConfirmThreshold ?? CLOSE_CONFIRM_THRESHOLD,
  );
  const currentWindowId = useTabsStore((s) => s.currentWindowId);

  const [aliasEditing, setAliasEditing] = useState(false);
  const [aliasDraft, setAliasDraft] = useState(alias ?? "");
  const [busy, setBusy] = useState(false);

  const runWindowAction = async (action: () => Promise<void>, successMessage?: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      if (successMessage) feedback.success(successMessage);
      onRefresh();
    } catch (err) {
      feedback.error(t("操作失败，请重试"), err);
      onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const handleSaveAlias = () => {
    void setWindowAlias(windowId, aliasDraft);
    setAliasEditing(false);
  };

  const handleMergeToCurrent = () => {
    if (isCurrent) return;
    void runWindowAction(
      async () => {
        const tabIds = tabs.map((tab) => tab.id);
        for (let i = 0; i < tabIds.length; i += BATCH) {
          await moveTabs(tabIds.slice(i, i + BATCH), currentWindowId, -1);
        }
        swBroadcast("tab-moved", { windowId: currentWindowId, count: tabIds.length });
      },
      translate("已将 {count} 个标签合并到当前窗口", { count: tabs.length }),
    );
  };

  const handleCloseWindow = () => {
    const execute = () =>
      runWindowAction(async () => {
        await closeWindow(windowId);
        swBroadcast("tab-removed", { windowId, isWindowClosing: true });
      }, translate("窗口已关闭"));

    if (tabs.length > closeConfirmThreshold) {
      feedback.modal.confirm({
        title: t("确认关闭窗口"),
        content: t("确定要关闭该窗口及其 {count} 个标签页吗？", { count: tabs.length }),
        okButtonProps: { danger: true },
        onOk: execute,
      });
      return;
    }

    void execute();
  };

  const handleCreateGroupFromUngrouped = () => {
    if (ungroupedTabs.length === 0) return;
    void runWindowAction(async () => {
      const group = await createTabGroup(
        ungroupedTabs.map((tab) => tab.id),
        { windowId },
        { title: t("新建分组"), color: "blue" },
      );
      swBroadcast("tab-grouped", { groupId: group.id, windowId });
    }, translate("分组已创建"));
  };

  const handleSnap = (action: WindowSnapAction) => {
    void runWindowAction(async () => {
      await snapWindow(windowId, action);
    });
  };

  const handleArrangeAllWindows = (layout: SplitLayout) => {
    const windows = [
      windowId,
      ...[...useTabsStore.getState().windows.values()]
        .filter(
          (item) =>
            item.id !== windowId && item.type === "normal" && item.incognito === isIncognito,
        )
        .map((item) => item.id),
    ];
    void runWindowAction(async () => {
      await arrangeWindows(windows, layout);
    });
  };

  const menuItems = useMemo<MenuProps["items"]>(
    () => [
      {
        key: "alias",
        icon: <Edit3 size={ICON_SIZE.SMALL} />,
        label: t("重命名窗口"),
        onClick: () => {
          setAliasDraft(alias ?? "");
          setAliasEditing(true);
        },
      },
      {
        key: "merge",
        icon: <Merge size={ICON_SIZE.SMALL} />,
        label: t("合并到当前窗口"),
        disabled:
          isCurrent ||
          isIncognito !==
            (useTabsStore.getState().windows.get(currentWindowId)?.incognito ?? false),
        onClick: handleMergeToCurrent,
      },
      {
        key: "create-group",
        icon: <Plus size={ICON_SIZE.SMALL} />,
        label: t("从未分组创建分组"),
        disabled: ungroupedTabs.length === 0,
        onClick: handleCreateGroupFromUngrouped,
      },
      { type: "divider" as const },
      {
        key: "snap-left",
        label: t("贴左半屏"),
        onClick: () => handleSnap("snap-left"),
      },
      {
        key: "snap-right",
        label: t("贴右半屏"),
        onClick: () => handleSnap("snap-right"),
      },
      {
        key: "snap-maximize",
        label: t("最大化"),
        onClick: () => handleSnap("maximize"),
      },
      {
        key: "snap-center",
        label: t("居中 80%"),
        onClick: () => handleSnap("center"),
      },
      {
        key: "snap-restore",
        label: t("还原普通窗口"),
        onClick: () => handleSnap("restore"),
      },
      { type: "divider" as const },
      {
        key: "arrange-balanced-grid",
        label: t("自适应网格"),
        onClick: () => handleArrangeAllWindows("balanced-grid"),
      },
      {
        key: "arrange-side-by-side",
        label: t("左右分栏"),
        onClick: () => handleArrangeAllWindows("side-by-side"),
      },
      {
        key: "arrange-stacked",
        label: t("上下堆叠"),
        onClick: () => handleArrangeAllWindows("stacked"),
      },
      {
        key: "arrange-main-side",
        label: t("主区 + 侧栏"),
        onClick: () => handleArrangeAllWindows("main-side"),
      },
      { type: "divider" as const },
      {
        key: "close",
        danger: true,
        icon: <X size={ICON_SIZE.SMALL} />,
        label: t("关闭窗口"),
        disabled: isCurrent,
        onClick: handleCloseWindow,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isCurrent, isIncognito, ungroupedTabs.length, alias, busy, tabs.length, currentWindowId],
  );

  return {
    alias,
    aliasEditing,
    aliasDraft,
    setAliasDraft,
    busy,
    handleSaveAlias,
    handleMergeToCurrent,
    handleSnap,
    handleArrangeAllWindows,
    handleCloseWindow,
    menuItems,
    handleCreateGroupFromUngrouped,
  };
}
