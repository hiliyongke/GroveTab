/**
 * BatchActionBar — 多选批量操作浮动栏（antd 版）
 *
 * 设计：
 *   - 固定在页面底部居中，毛玻璃背景
 *   - 显示选中数量 + 操作按钮（关闭/休眠/归档/取消选择）
 *   - 使用 antd Button + Badge + Space，视觉与全站一致
 *   - 操作执行后自动清空选中并退出多选模式
 */

import { useCallback, useMemo } from "react";
import {
  Button,
  Badge,
  Tooltip,
  Popconfirm,
  theme,
  Input,
  Select,
  Flex,
  Typography,
  Dropdown,
} from "antd";
import type { MenuProps } from "antd";
import {
  X,
  Moon,
  Save,
  Pointer,
  XCircle,
  ExternalLink,
  FolderPlus,
  FolderInput,
  Columns2,
} from "lucide-react";
import { cssVars } from "@/shared/utils/css-vars";
import { useShallow } from "zustand/shallow";
import { useSelectionStore, useTabsStore } from "@/store";
import { iconColor } from "@/shared/utils/icon-colors";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { archiveSelectedTabs } from "@/services";
import { createWindowWithTab, moveTabs, splitTabsToLayout, type SplitLayout } from "@/chrome/tabs";
import { createTabGroup, groupTabs } from "@/chrome/tabGroups";
import { swBroadcast } from "@/shared/utils/sw-broadcast";
import { useT } from "@/shared/i18n";
import { feedback } from "@/shared/ui/feedback";
import { translate } from "@/shared/i18n/core";
import { Z } from "@/shared/config/z-index";
import styles from "../styles/views.module.less";

const BATCH = 10;
const MAX_SPLIT_TABS = 8;

/**
 * 批量操作浮动栏
 *
 * 仅在 selectionMode=true 且 selectedIds 非空时渲染。
 * 固定在视口底部居中，z-index 高于内容区。
 */
export function BatchActionBar() {
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const selectionMode = useSelectionStore((s) => s.selectionMode);
  const resetAfterBatch = useSelectionStore((s) => s.resetAfterBatch);
  const exitSelectionMode = useSelectionStore((s) => s.exitSelectionMode);
  const closeMultipleTabs = useTabsStore((s) => s.closeMultipleTabs);
  const discardMultipleTabs = useTabsStore((s) => s.discardMultipleTabs);
  const tabs = useTabsStore(useShallow((s) => s.tabs));
  const loadAllTabs = useTabsStore((s) => s.loadAllTabs);
  const { t } = useT();
  const { token } = theme.useToken();

  const count = selectedIds.size;
  const selectedTabs = useMemo(
    () => tabs.filter((tab) => selectedIds.has(tab.id)),
    [selectedIds, tabs],
  );
  const existingGroups = useMemo(() => {
    const seen = new Set<number>();
    return tabs
      .filter(
        (tab) => tab.groupId !== -1 && !seen.has(tab.groupId) && (seen.add(tab.groupId) || true),
      )
      .map((tab) => ({
        groupId: tab.groupId,
        windowId: tab.windowId,
        incognito: tab.incognito,
        title: tab.groupTitle?.trim() ?? t("未命名分组"),
      }));
  }, [tabs, t]);

  /** 批量关闭 */
  const handleBatchClose = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      await closeMultipleTabs(ids);
      resetAfterBatch();
    } catch {
      // store 已 toast
    }
  }, [selectedIds, closeMultipleTabs, resetAfterBatch]);

  /** 批量休眠。 */
  const handleBatchDiscard = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      await discardMultipleTabs(ids);
      resetAfterBatch();
    } catch {
      // store 已统一反馈
    }
  }, [selectedIds, discardMultipleTabs, resetAfterBatch]);

  /** 批量归档：统一走归档服务，避免直接写 storage。 */
  const handleBatchArchive = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    try {
      const { archivedCount, closedCount } = await archiveSelectedTabs(ids);
      feedback.success(translate("已归档 {count} 个标签页", { count: archivedCount }));
      if (closedCount < archivedCount) {
        feedback.warning(
          translate("已有 {count} 个标签页未能关闭，可稍后手动处理", {
            count: archivedCount - closedCount,
          }),
        );
      }
      resetAfterBatch();
    } catch (err) {
      feedback.error(translate("归档失败，请重试"), err);
    }
  }, [selectedIds, resetAfterBatch]);

  const ensureSameProfile = useCallback(() => {
    if (selectedTabs.length === 0) return false;
    const incognito = selectedTabs[0]?.incognito ?? false;
    const sameProfile = selectedTabs.every((tab) => tab.incognito === incognito);
    if (!sameProfile) feedback.warning(t("隐身窗口与普通窗口的标签不能混合移动或分组"));
    return sameProfile;
  }, [selectedTabs, t]);

  const handleMoveToNewWindow = useCallback(async () => {
    if (!ensureSameProfile()) return;
    const [firstTab, ...restTabs] = selectedTabs;
    if (!firstTab) return;
    try {
      const newWindow = await createWindowWithTab(firstTab.id);
      if (!newWindow.id) throw new Error("new window has no id");
      const restIds = restTabs.map((tab) => tab.id);
      for (let i = 0; i < restIds.length; i += BATCH) {
        await moveTabs(restIds.slice(i, i + BATCH), newWindow.id, -1);
      }
      swBroadcast("tab-moved", { windowId: newWindow.id, count: selectedTabs.length });
      feedback.success(t("已将 {count} 个标签移到新窗口", { count: selectedTabs.length }));
      resetAfterBatch();
      void loadAllTabs({ silent: true });
    } catch (err) {
      feedback.error(t("移动所选标签失败，请重试"), err);
      void loadAllTabs({ silent: true });
    }
  }, [ensureSameProfile, selectedTabs, resetAfterBatch, loadAllTabs, t]);

  const handleCreateGroup = useCallback(() => {
    if (!ensureSameProfile()) return;
    let groupName = t("新分组");
    feedback.modal.confirm({
      title: t("新建分组"),
      content: (
        <Input
          autoFocus
          defaultValue={groupName}
          placeholder={t("输入分组名称")}
          onChange={(event) => {
            groupName = event.target.value;
          }}
        />
      ),
      okText: t("新建分组"),
      cancelText: t("取消"),
      onOk: async () => {
        const [firstTab] = selectedTabs;
        if (!firstTab) return;
        try {
          const ids = selectedTabs.map((tab) => tab.id);
          const otherWindowIds = selectedTabs
            .filter((tab) => tab.windowId !== firstTab.windowId)
            .map((tab) => tab.id);
          for (let i = 0; i < otherWindowIds.length; i += BATCH) {
            await moveTabs(otherWindowIds.slice(i, i + BATCH), firstTab.windowId, -1);
          }
          const group = await createTabGroup(
            ids,
            { windowId: firstTab.windowId },
            {
              title: groupName.trim() || t("新分组"),
              color: "blue",
            },
          );
          swBroadcast("tab-grouped", {
            groupId: group.id,
            windowId: firstTab.windowId,
            count: ids.length,
          });
          feedback.success(t("已创建分组"));
          resetAfterBatch();
          void loadAllTabs({ silent: true });
        } catch (err) {
          feedback.error(t("批量分组失败，请重试"), err);
          void loadAllTabs({ silent: true });
        }
      },
    });
  }, [ensureSameProfile, selectedTabs, resetAfterBatch, loadAllTabs, t]);

  /**
   * 高级分屏：把选中的 tabs 各自拆到独立窗口，并按用户选择的布局排布。
   *
   * 选中超过 MAX_SPLIT_TABS 时不允许操作，避免创建过多浏览器窗口造成干扰。
   */
  const handleSplitLayout = useCallback(
    async (layout: SplitLayout) => {
      if (!ensureSameProfile()) return;
      if (selectedTabs.length < 2) {
        feedback.warning(t("请至少选中 2 个标签页"));
        return;
      }
      if (selectedTabs.length > MAX_SPLIT_TABS) {
        feedback.warning(t("最多支持分屏 {count} 个标签页", { count: MAX_SPLIT_TABS }));
        return;
      }
      try {
        const ids = selectedTabs.map((tab) => tab.id);
        await splitTabsToLayout(ids, layout);
        swBroadcast("tab-moved", { count: selectedTabs.length });
        feedback.success(t("已并排打开 {count} 个标签页", { count: selectedTabs.length }));
        resetAfterBatch();
        void loadAllTabs({ silent: true });
      } catch (err) {
        feedback.error(t("分屏操作失败，请重试"), err);
        void loadAllTabs({ silent: true });
      }
    },
    [ensureSameProfile, selectedTabs, resetAfterBatch, loadAllTabs, t],
  );

  const splitMenuItems = useMemo<MenuProps["items"]>(
    () => [
      {
        key: "balanced-grid",
        label: t("自适应网格"),
        onClick: () => {
          void handleSplitLayout("balanced-grid");
        },
      },
      {
        key: "side-by-side",
        label: t("左右分栏"),
        onClick: () => {
          void handleSplitLayout("side-by-side");
        },
      },
      {
        key: "stacked",
        label: t("上下堆叠"),
        onClick: () => {
          void handleSplitLayout("stacked");
        },
      },
      {
        key: "main-side",
        label: t("主区 + 侧栏"),
        onClick: () => {
          void handleSplitLayout("main-side");
        },
      },
    ],
    [handleSplitLayout, t],
  );

  const handleJoinExistingGroup = useCallback(() => {
    if (selectedTabs.length === 0 || existingGroups.length === 0) return;
    let targetGroupId = existingGroups[0]?.groupId;
    feedback.modal.confirm({
      title: t("加入现有分组"),
      content: (
        <Select
          autoFocus
          defaultValue={targetGroupId}
          className={styles["app-batch-bar__select"]}
          options={existingGroups.map((group) => ({
            value: group.groupId,
            label: `${group.title} · ${t("窗口 {id}", { id: group.windowId })}`,
          }))}
          onChange={(value) => {
            targetGroupId = value;
          }}
        />
      ),
      okText: t("加入现有分组"),
      cancelText: t("取消"),
      onOk: async () => {
        const target = existingGroups.find((group) => group.groupId === targetGroupId);
        if (!target) return;
        if (!selectedTabs.every((tab) => tab.incognito === target.incognito)) {
          feedback.warning(t("隐身窗口与普通窗口的标签不能混合移动或分组"));
          return;
        }
        try {
          const ids = selectedTabs.map((tab) => tab.id);
          const moveIds = selectedTabs
            .filter((tab) => tab.windowId !== target.windowId)
            .map((tab) => tab.id);
          for (let i = 0; i < moveIds.length; i += BATCH) {
            await moveTabs(moveIds.slice(i, i + BATCH), target.windowId, -1);
          }
          await groupTabs({ tabIds: ids, groupId: target.groupId });
          swBroadcast("tab-grouped", {
            groupId: target.groupId,
            windowId: target.windowId,
            count: ids.length,
          });
          feedback.success(t("已加入目标分组"));
          resetAfterBatch();
          void loadAllTabs({ silent: true });
        } catch (err) {
          feedback.error(t("批量分组失败，请重试"), err);
          void loadAllTabs({ silent: true });
        }
      },
    });
  }, [existingGroups, selectedTabs, resetAfterBatch, loadAllTabs, t]);

  // 进入/退出多选模式时通过 aria-live 公告
  if (!selectionMode || count === 0) return null;

  const batchBarStyle: React.CSSProperties = cssVars({
    "--app-batch-bar-z": String(Z.batchBar),
    "--app-batch-bar-danger-icon": iconColor("close", token),
    "--app-batch-bar-discard-icon": iconColor("discard", token),
  });

  return (
    <Flex
      className={`${styles["app-batch-bar"]} app-surface-elevated`}
      role="toolbar"
      aria-label={t("多选模式")}
      style={batchBarStyle}
      align="center"
      justify="space-between"
    >
      {/* 计数标签组：图标 + 选中数 */}
      <Flex align="center" gap="small" className={styles["app-batch-bar__summary"]}>
        <Badge count={count} color={token.colorPrimary} offset={[0, 0]}>
          <Pointer size={ICON_SIZE.LARGE} className={styles["app-batch-bar__pointer"]} />
        </Badge>
        <Typography.Text className={styles["app-batch-bar__summary-copy"]}>
          {t("多选模式")}
        </Typography.Text>
      </Flex>

      <div className={styles["app-divider-soft"]} aria-hidden />

      {/* 操作组：危险→中性→主要，视觉权重递增 */}
      <Flex align="center" gap="small" className={styles["app-batch-bar__actions"]}>
        <Tooltip title={t("关闭所选")} placement="top">
          <Popconfirm
            title={t("确认关闭 {count} 个标签页？此操作可通过撤销恢复。", { count })}
            onConfirm={() => {
              void handleBatchClose();
            }}
            okText={t("关闭所选")}
            cancelText={t("取消")}
            okButtonProps={{ danger: true, size: "small" }}
            cancelButtonProps={{ size: "small" }}
          >
            <Button
              danger
              icon={<X size={ICON_SIZE.DEFAULT} className={styles["app-batch-bar__danger-icon"]} />}
            >
              {t("关闭所选")}
            </Button>
          </Popconfirm>
        </Tooltip>

        <Tooltip title={t("休眠所选")} placement="top">
          <Button
            icon={
              <Moon size={ICON_SIZE.DEFAULT} className={styles["app-batch-bar__secondary-icon"]} />
            }
            onClick={() => {
              void handleBatchDiscard();
            }}
          >
            {t("休眠所选")}
          </Button>
        </Tooltip>

        <Tooltip title={t("移到新窗口")} placement="top">
          <Button
            icon={<ExternalLink size={ICON_SIZE.DEFAULT} />}
            onClick={() => {
              void handleMoveToNewWindow();
            }}
          >
            {t("移到新窗口")}
          </Button>
        </Tooltip>

        {/* 高级分屏：支持左右、上下、主次与自适应网格布局 */}
        <Dropdown
          menu={{ items: splitMenuItems }}
          trigger={["click"]}
          disabled={count < 2 || count > MAX_SPLIT_TABS}
        >
          <Tooltip title={t("把选中的标签页拆成独立窗口并选择布局")} placement="top">
            <Button
              icon={<Columns2 size={ICON_SIZE.DEFAULT} />}
              disabled={count < 2 || count > MAX_SPLIT_TABS}
            >
              {t("分屏布局")}
            </Button>
          </Tooltip>
        </Dropdown>

        <Tooltip title={t("新建分组")} placement="top">
          <Button
            icon={<FolderPlus size={ICON_SIZE.DEFAULT} />}
            onClick={handleCreateGroup}
          >
            {t("新建分组")}
          </Button>
        </Tooltip>

        <Tooltip title={t("加入现有分组")} placement="top">
          <Button
            icon={<FolderInput size={ICON_SIZE.DEFAULT} />}
            disabled={existingGroups.length === 0}
            onClick={handleJoinExistingGroup}
          >
            {t("加入现有分组")}
          </Button>
        </Tooltip>

        {/* 归档按钮 - 突出显示作为主要操作之一 */}
        <Tooltip
          title={t("归档保存所选标签页，之后可在归档面板恢复。比关闭更安全，不会丢失页面。")}
          placement="top"
        >
          <Popconfirm
            title={t("确认归档 {count} 个标签页？", { count })}
            description={t("归档后标签页会被保存并关闭，随时可在左侧边栏的「归档」中恢复。")}
            onConfirm={() => {
              void handleBatchArchive();
            }}
            okText={t("归档")}
            cancelText={t("取消")}
            okButtonProps={{ size: "small", type: "primary" }}
            cancelButtonProps={{ size: "small" }}
          >
            <Button
              type="primary"
              icon={<Save size={ICON_SIZE.DEFAULT} />}
              className={styles["app-batch-bar__archive-btn"]}
            >
              {t("归档")}
            </Button>
          </Popconfirm>
        </Tooltip>
      </Flex>

      <Flex className={styles["app-divider-soft"]} aria-hidden />

      <Tooltip title={t("取消选择")} placement="top">
        <Button
          type="text"
          icon={
            <XCircle size={ICON_SIZE.DEFAULT} className={styles["app-batch-bar__danger-icon"]} />
          }
          onClick={exitSelectionMode}
          aria-label={t("取消选择")}
        />
      </Tooltip>
    </Flex>
  );
}
