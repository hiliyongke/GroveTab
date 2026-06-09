/**
 * WindowBatchActionBar — 窗口视图批量操作工具栏
 *
 * 选中标签后底部浮出，提供 4 个批量操作：
 *   - 移动到窗口（弹出窗口选择器）
 *   - 关闭
 *   - 归档
 *   - 创建分组
 *
 * 复用 selection-slice 和已有的批量操作逻辑。
 */

import { useState, useCallback, memo } from "react";
import { Button, Flex, Modal, Typography, Input, theme, Space } from "antd";
import { ArrowRightLeft, FolderPlus, Inbox, Monitor, X } from "lucide-react";

import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useT } from "@/shared/i18n";
import { useShallow } from "zustand/shallow";
import { useSelectionStore, useTabsStore } from "@/store";
import { moveTabs, closeTabs, createTabGroup } from "@/chrome";
import { archiveSelectedTabs } from "@/services/archive";
import { feedback } from "@/shared/ui/feedback";
import { swBroadcast } from "@/shared/utils/sw-broadcast";
import styles from "@/features/tabs/styles/views.module.less";

const BATCH = 10;

export const WindowBatchActionBar = memo(function WindowBatchActionBar() {
  const { t } = useT();
  const { token } = theme.useToken();
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const selectionMode = useSelectionStore((s) => s.selectionMode);
  const exitSelectionMode = useSelectionStore((s) => s.exitSelectionMode);
  const resetAfterBatch = useSelectionStore((s) => s.resetAfterBatch);
  const selectAll = useSelectionStore((s) => s.selectAll);
  const tabs = useTabsStore(useShallow((s) => s.tabs));
  const windows = useTabsStore((s) => s.windows);
  const currentWindowId = useTabsStore((s) => s.currentWindowId);
  const loadAllTabs = useTabsStore((s) => s.loadAllTabs);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveSearch, setMoveSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedCount = selectedIds.size;
  const selectedArr = [...selectedIds];

  // 窗口列表供移动选择
  const windowList = [...windows.values()]
    .filter((w) => w.type === "normal")
    .sort((a, b) => (a.id === currentWindowId ? -1 : b.id === currentWindowId ? 1 : 0));

  const filteredWindows = moveSearch.trim()
    ? windowList.filter((w) => {
        const alias = useTabsStore.getState().windows.get(w.id);
        return String(w.id).includes(moveSearch) || String(alias).includes(moveSearch);
      })
    : windowList;

  const handleBatchClose = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const tabIds = selectedArr;
      for (let i = 0; i < tabIds.length; i += BATCH) {
        await closeTabs(tabIds.slice(i, i + BATCH));
      }
      swBroadcast("tab-removed", { count: tabIds.length });
      resetAfterBatch();
      feedback.success(t("已关闭 {count} 个标签", { count: tabIds.length }));
    } catch (err) {
      feedback.error(t("批量关闭失败"), err);
    } finally {
      setBusy(false);
      void loadAllTabs({ silent: true });
    }
  }, [busy, selectedArr, resetAfterBatch, t, loadAllTabs]);

  const handleBatchArchive = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await archiveSelectedTabs(selectedArr);
      resetAfterBatch();
      feedback.success(t("已归档 {count} 个标签", { count: selectedArr.length }));
    } catch (err) {
      feedback.error(t("归档失败"), err);
    } finally {
      setBusy(false);
      void loadAllTabs({ silent: true });
    }
  }, [busy, selectedArr, resetAfterBatch, t, loadAllTabs]);

  const handleBatchGroup = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      // 找到第一个选中标签的窗口
      const firstTab = tabs.find((tab) => selectedIds.has(tab.id));
      if (!firstTab) return;
      await createTabGroup(
        selectedArr,
        { windowId: firstTab.windowId },
        { title: "", color: "blue" },
      );
      swBroadcast("tab-grouped", { windowId: firstTab.windowId });
      resetAfterBatch();
      feedback.success(t("已创建分组"));
    } catch (err) {
      feedback.error(t("创建分组失败"), err);
    } finally {
      setBusy(false);
      void loadAllTabs({ silent: true });
    }
  }, [busy, selectedArr, selectedIds, tabs, resetAfterBatch, t, loadAllTabs]);

  const handleMoveToWindow = useCallback(
    async (targetWindowId: number) => {
      if (busy) return;
      setBusy(true);
      try {
        for (let i = 0; i < selectedArr.length; i += BATCH) {
          await moveTabs(selectedArr.slice(i, i + BATCH), targetWindowId, -1);
        }
        swBroadcast("tab-moved", { windowId: targetWindowId, count: selectedArr.length });
        resetAfterBatch();
        setMoveModalOpen(false);
        feedback.success(t("已移动 {count} 个标签", { count: selectedArr.length }));
      } catch (err) {
        feedback.error(t("移动失败"), err);
      } finally {
        setBusy(false);
        void loadAllTabs({ silent: true });
      }
    },
    [busy, selectedArr, resetAfterBatch, t, loadAllTabs],
  );

  const handleSelectAll = useCallback(() => {
    const allTabIds = tabs.map((tab) => tab.id);
    selectAll(allTabIds);
  }, [tabs, selectAll]);

  if (!selectionMode || selectedCount === 0) return null;

  return (
    <>
      <div
        className={styles["app-batch-bar"]}
        style={{
          background: token.colorBgElevated,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadiusLG,
          boxShadow: token.boxShadowSecondary,
        }}
      >
        <Flex align="center" gap={8} className={styles["app-batch-bar__summary"]}>
          <Typography.Text className={styles["app-batch-bar__summary-copy"]}>
            {t("已选 {count} 项", { count: selectedCount })}
          </Typography.Text>
          <Button type="link" onClick={handleSelectAll}>
            {t("全选")}
          </Button>
        </Flex>
        <Flex align="center" gap={6} className={styles["app-batch-bar__actions"]}>
          <Button
            icon={<ArrowRightLeft size={ICON_SIZE.SMALL} />}
            onClick={() => setMoveModalOpen(true)}
          >
            {t("移动到窗口")}
          </Button>
          <Button
            danger
            icon={<X size={ICON_SIZE.SMALL} className={styles["app-batch-bar__danger-icon"]} />}
            loading={busy}
            onClick={() => void handleBatchClose()}
          >
            {t("关闭")}
          </Button>
          <Button
            icon={
              <Inbox size={ICON_SIZE.SMALL} className={styles["app-batch-bar__secondary-icon"]} />
            }
            loading={busy}
            onClick={() => void handleBatchArchive()}
          >
            {t("归档")}
          </Button>
          <Button
            icon={<FolderPlus size={ICON_SIZE.SMALL} />}
            onClick={() => void handleBatchGroup()}
          >
            {t("创建分组")}
          </Button>
        </Flex>
        <Button type="text" onClick={exitSelectionMode}>
          {t("取消")}
        </Button>
      </div>

      {/* 移动到窗口选择器 */}
      <Modal
        title={t("移动到窗口")}
        open={moveModalOpen}
        onCancel={() => setMoveModalOpen(false)}
        footer={null}
        width={360}
      >
        <Input
          placeholder={t("搜索窗口...")}
          value={moveSearch}
          onChange={(e) => setMoveSearch(e.target.value)}
          allowClear
          style={{ marginBottom: "var(--app-space-3)" }}
        />
        <Space vertical style={{ width: "100%" }}>
          {filteredWindows.map((w) => (
            <Button
              key={w.id}
              block
              type={w.id === currentWindowId ? "primary" : "default"}
              icon={<Monitor size={ICON_SIZE.SMALL} />}
              onClick={() => void handleMoveToWindow(w.id)}
              style={{ textAlign: "left" }}
            >
              {w.id === currentWindowId
                ? t("当前窗口")
                : `${t("窗口 {id}", { id: w.id })} (${w.tabsCount})`}
            </Button>
          ))}
        </Space>
      </Modal>
    </>
  );
});
