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
import { Button, Badge, Tooltip, Popconfirm, Divider, theme, Modal, Input, Select } from "antd";
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
import styles from "./styles/views.module.less";

const BATCH = 10;

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
  const tabs = useTabsStore((s) => s.tabs);
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
        title: tab.groupTitle?.trim() || t("windowGroup.untitled"),
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
      feedback.success(translate("archive.archivedOk", { count: archivedCount }));
      if (closedCount < archivedCount) {
        feedback.warning(
          translate("archive.closeIncomplete", { count: archivedCount - closedCount }),
        );
      }
      resetAfterBatch();
    } catch (err) {
      feedback.error(translate("archive.archiveFailed"), err);
    }
  }, [selectedIds, resetAfterBatch]);

  const ensureSameProfile = useCallback(() => {
    if (selectedTabs.length === 0) return false;
    const incognito = selectedTabs[0]?.incognito ?? false;
    const sameProfile = selectedTabs.every((tab) => tab.incognito === incognito);
    if (!sameProfile) feedback.warning(t("batch.profileMixed"));
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
      feedback.success(t("batch.movedToNewWindow", { count: selectedTabs.length }));
      resetAfterBatch();
      void loadAllTabs({ silent: true });
    } catch (err) {
      feedback.error(t("batch.moveFailed"), err);
      void loadAllTabs({ silent: true });
    }
  }, [ensureSameProfile, selectedTabs, resetAfterBatch, loadAllTabs, t]);

  const handleCreateGroup = useCallback(() => {
    if (!ensureSameProfile()) return;
    let groupName = t("windowGroup.newGroup");
    Modal.confirm({
      title: t("batch.createGroup"),
      content: (
        <Input
          autoFocus
          defaultValue={groupName}
          placeholder={t("batch.groupNamePlaceholder")}
          onChange={(event) => {
            groupName = event.target.value;
          }}
        />
      ),
      okText: t("batch.createGroup"),
      cancelText: t("archive.cancel"),
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
              title: groupName.trim() || t("windowGroup.newGroup"),
              color: "blue",
            },
          );
          swBroadcast("tab-grouped", {
            groupId: group.id,
            windowId: firstTab.windowId,
            count: ids.length,
          });
          feedback.success(t("windowGroup.created"));
          resetAfterBatch();
          void loadAllTabs({ silent: true });
        } catch (err) {
          feedback.error(t("batch.groupFailed"), err);
          void loadAllTabs({ silent: true });
        }
      },
    });
  }, [ensureSameProfile, selectedTabs, resetAfterBatch, loadAllTabs, t]);

  /**
   * 并排打开：把选中的 2-4 个 tabs 各自拆到独立窗口，并按选中数量自动选择布局：
   *   - 2 → 左右半屏 (side-by-side)
   *   - 3 → 三等分横向 (thirds)
   *   - 4 → 田字 2x2 (grid-2x2)
   *
   * 选中超过 4 个时不允许操作（避免屏幕窗口太碎），由 UI 通过 disabled 表达。
   */
  const handleSplitSideBySide = useCallback(async () => {
    if (!ensureSameProfile()) return;
    if (selectedTabs.length < 2) {
      feedback.warning(t("split.needTwo"));
      return;
    }
    if (selectedTabs.length > 4) {
      feedback.warning(t("split.tooMany"));
      return;
    }
    const layoutByCount: Record<number, SplitLayout> = {
      2: "side-by-side",
      3: "thirds",
      4: "grid-2x2",
    };
    const layout = layoutByCount[selectedTabs.length] ?? "side-by-side";
    try {
      const ids = selectedTabs.map((tab) => tab.id);
      await splitTabsToLayout(ids, layout);
      swBroadcast("tab-moved", { count: selectedTabs.length });
      feedback.success(t("split.openedSideBySide", { count: selectedTabs.length }));
      resetAfterBatch();
      void loadAllTabs({ silent: true });
    } catch (err) {
      feedback.error(t("split.failed"), err);
      void loadAllTabs({ silent: true });
    }
  }, [ensureSameProfile, selectedTabs, resetAfterBatch, loadAllTabs, t]);

  const handleJoinExistingGroup = useCallback(() => {
    if (selectedTabs.length === 0 || existingGroups.length === 0) return;
    let targetGroupId = existingGroups[0]?.groupId;
    Modal.confirm({
      title: t("batch.joinExistingGroup"),
      content: (
        <Select
          autoFocus
          defaultValue={targetGroupId}
          style={{ width: "100%" }}
          options={existingGroups.map((group) => ({
            value: group.groupId,
            label: `${group.title} · ${t("window.otherWithId", { id: group.windowId })}`,
          }))}
          onChange={(value) => {
            targetGroupId = value;
          }}
        />
      ),
      okText: t("batch.joinExistingGroup"),
      cancelText: t("archive.cancel"),
      onOk: async () => {
        const target = existingGroups.find((group) => group.groupId === targetGroupId);
        if (!target) return;
        if (!selectedTabs.every((tab) => tab.incognito === target.incognito)) {
          feedback.warning(t("batch.profileMixed"));
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
          feedback.success(t("batch.joinedGroup"));
          resetAfterBatch();
          void loadAllTabs({ silent: true });
        } catch (err) {
          feedback.error(t("batch.groupFailed"), err);
          void loadAllTabs({ silent: true });
        }
      },
    });
  }, [existingGroups, selectedTabs, resetAfterBatch, loadAllTabs, t]);

  // 非多选模式或无选中时不渲染
  if (!selectionMode || count === 0) return null;

  const batchBarStyle: React.CSSProperties = cssVars({
    "--app-batch-bar-z": String(Z.batchBar),
    "--app-batch-bar-danger-icon": iconColor("close", token),
    "--app-batch-bar-discard-icon": iconColor("discard", token),
  });

  return (
    <div
      className={`${styles["app-batch-bar"]} app-surface-elevated`}
      role="toolbar"
      aria-label={t("selection.title")}
      style={batchBarStyle}
    >
      {/* 计数标签组：图标 + 选中数 */}
      <div className={styles["app-batch-bar__summary"]}>
        <Badge count={count} size="small" color={token.colorPrimary} offset={[0, 0]}>
          <Pointer size={ICON_SIZE.LARGE} className={styles["app-batch-bar__pointer"]} />
        </Badge>
        <span className={styles["app-batch-bar__summary-copy"]}>{t("selection.title")}</span>
      </div>

      <Divider type="vertical" className={styles["app-divider-soft"]} aria-hidden />

      {/* 操作组：危险→中性→主要，视觉权重递增 */}
      <div className={styles["app-batch-bar__actions"]}>
        <Tooltip title={t("batch.close")} placement="top">
          <Popconfirm
            title={t("batch.closeConfirm", { count })}
            onConfirm={() => {
              void handleBatchClose();
            }}
            okText={t("batch.close")}
            cancelText={t("archive.cancel")}
            okButtonProps={{ danger: true, size: "small" }}
            cancelButtonProps={{ size: "small" }}
          >
            <Button
              size="small"
              danger
              icon={<X size={ICON_SIZE.DEFAULT} className={styles["app-batch-bar__danger-icon"]} />}
            >
              {t("batch.close")}
            </Button>
          </Popconfirm>
        </Tooltip>

        <Tooltip title={t("batch.discard")} placement="top">
          <Button
            size="small"
            icon={
              <Moon size={ICON_SIZE.DEFAULT} className={styles["app-batch-bar__secondary-icon"]} />
            }
            onClick={() => {
              void handleBatchDiscard();
            }}
          >
            {t("batch.discard")}
          </Button>
        </Tooltip>

        <Tooltip title={t("batch.moveToNewWindow")} placement="top">
          <Button
            size="small"
            icon={<ExternalLink size={ICON_SIZE.DEFAULT} />}
            onClick={() => {
              void handleMoveToNewWindow();
            }}
          >
            {t("batch.moveToNewWindow")}
          </Button>
        </Tooltip>

        {/* 并排打开（分屏）：仅在 2-4 选中时可用，自动选择布局 */}
        <Tooltip title={t("split.openSideBySideTooltip")} placement="top">
          <Button
            size="small"
            icon={<Columns2 size={ICON_SIZE.DEFAULT} />}
            disabled={count < 2 || count > 4}
            onClick={() => {
              void handleSplitSideBySide();
            }}
          >
            {t("split.openSideBySide")}
          </Button>
        </Tooltip>

        <Tooltip title={t("batch.createGroup")} placement="top">
          <Button
            size="small"
            icon={<FolderPlus size={ICON_SIZE.DEFAULT} />}
            onClick={handleCreateGroup}
          >
            {t("batch.createGroup")}
          </Button>
        </Tooltip>

        <Tooltip title={t("batch.joinExistingGroup")} placement="top">
          <Button
            size="small"
            icon={<FolderInput size={ICON_SIZE.DEFAULT} />}
            disabled={existingGroups.length === 0}
            onClick={handleJoinExistingGroup}
          >
            {t("batch.joinExistingGroup")}
          </Button>
        </Tooltip>

        <Tooltip title={t("batch.archive")} placement="top">
          <Popconfirm
            title={t("batch.archiveConfirm", { count })}
            onConfirm={() => {
              void handleBatchArchive();
            }}
            okText={t("batch.archive")}
            cancelText={t("archive.cancel")}
            okButtonProps={{ size: "small" }}
            cancelButtonProps={{ size: "small" }}
          >
            <Button size="small" type="primary" icon={<Save size={ICON_SIZE.DEFAULT} />}>
              {t("batch.archive")}
            </Button>
          </Popconfirm>
        </Tooltip>
      </div>

      <div className={styles["app-divider-soft"]} aria-hidden />

      <Tooltip title={t("batch.cancel")} placement="top">
        <Button
          size="small"
          type="text"
          icon={
            <XCircle size={ICON_SIZE.DEFAULT} className={styles["app-batch-bar__danger-icon"]} />
          }
          onClick={exitSelectionMode}
          aria-label={t("batch.cancel")}
        />
      </Tooltip>
    </div>
  );
}
