/**
 * WindowToolbar — 窗口视图增强工具栏
 *
 * 常驻显示在 WindowView 上方：
 *   - 搜索过滤（按标签标题/URL）
 *   - 排序切换（手动/标签数/名称/活跃度）
 *   - 快照入口
 *   - 批量模式入口
 */

import { Button, Popover, Select, Tooltip, Typography } from "antd";
import { Camera, CheckSquare } from "lucide-react";
import { useSelectionStore, useTabsStore } from "@/store";
import { useT } from "@/shared/i18n";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { ViewToolbar } from "./ViewToolbar";
import { WindowSnapshotPanel } from "../views/WindowView/WindowSnapshotPanel";
import { ClipboardImport } from "../views/WindowView/ClipboardImport";
import styles from "../styles/items.module.less";

export type WindowSortMode = "manual" | "tabCount" | "name" | "activity";

export interface WindowToolbarProps {
  filterQuery: string;
  onFilterChange: (query: string) => void;
  sortMode?: WindowSortMode;
  onSortModeChange?: (mode: WindowSortMode) => void;
}

export function WindowToolbar({
  filterQuery,
  onFilterChange,
  sortMode = "manual",
  onSortModeChange,
}: WindowToolbarProps) {
  const { t } = useT();
  const currentWindowId = useTabsStore((s) => s.currentWindowId);
  const loadAllTabs = useTabsStore((s) => s.loadAllTabs);
  const selectionMode = useSelectionStore((s) => s.selectionMode);
  const enterSelectionMode = useSelectionStore((s) => s.enterSelectionMode);
  const exitSelectionMode = useSelectionStore((s) => s.exitSelectionMode);
  const selectedCount = useSelectionStore((s) => s.selectedIds.size);

  return (
    <ViewToolbar
      searchQuery={filterQuery}
      onSearchChange={onFilterChange}
      searchPlaceholder={t("搜索窗口…")}
    >
      {/* 排序切换 */}
      <Select
        size="small"
        value={sortMode}
        onChange={(v) => onSortModeChange?.(v as WindowSortMode)}
        options={[
          { value: "manual", label: t("手动") },
          { value: "tabCount", label: t("标签数") },
          { value: "name", label: t("名称") },
          { value: "activity", label: t("活跃度") },
        ]}
        className={styles["app-toolbar-sort-select"]}
      />

      {/* 快照入口 */}
      <Popover
        trigger="click"
        placement="bottomRight"
        content={
          <WindowSnapshotPanel
            windowId={currentWindowId}
            onRefresh={() => void loadAllTabs({ silent: true })}
          />
        }
      >
        <Tooltip title={t("窗口快照")}>
          <span>
            <Button type="text" size="small" icon={<Camera size={ICON_SIZE.SMALL} />} />
          </span>
        </Tooltip>
      </Popover>

      {/* 批量模式入口 */}
      <Tooltip title={selectionMode ? t("退出批量模式") : t("批量选择")}>
        <Button
          type={selectionMode ? "primary" : "text"}
          size="small"
          icon={<CheckSquare size={ICON_SIZE.SMALL} />}
          onClick={() => {
            if (selectionMode) {
              exitSelectionMode();
            } else {
              enterSelectionMode();
            }
          }}
        />
      </Tooltip>

      {/* 剪贴板导入 */}
      <ClipboardImport onRefresh={() => void loadAllTabs({ silent: true })} />

      {/* 批量模式状态提示 */}
      {selectionMode && selectedCount > 0 && (
        <Typography.Text style={{ color: "var(--ant-color-primary)", flexShrink: 0 }}>
          {t("已选 {count} 项", { count: selectedCount })}
        </Typography.Text>
      )}
    </ViewToolbar>
  );
}
