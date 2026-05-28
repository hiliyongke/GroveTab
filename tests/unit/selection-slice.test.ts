/**
 * Selection Slice 单元测试
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useSelectionStore } from "@/store/selection-slice";

beforeEach(() => {
  useSelectionStore.setState({
    selectedIds: new Set<number>(),
    selectionMode: false,
    lastClickedId: null,
  });
});

describe("toggleSelect — 选择/取消选择单个 tab", () => {
  it("选中一个 tab", () => {
    useSelectionStore.getState().toggleSelect(1);
    expect(useSelectionStore.getState().selectedIds.has(1)).toBe(true);
    expect(useSelectionStore.getState().selectionMode).toBe(true);
    expect(useSelectionStore.getState().lastClickedId).toBe(1);
  });

  it("取消选中一个 tab", () => {
    useSelectionStore.getState().toggleSelect(1);
    useSelectionStore.getState().toggleSelect(1);
    expect(useSelectionStore.getState().selectedIds.has(1)).toBe(false);
  });

  it("选中多个 tab", () => {
    useSelectionStore.getState().toggleSelect(1);
    useSelectionStore.getState().toggleSelect(2);
    useSelectionStore.getState().toggleSelect(3);
    const ids = useSelectionStore.getState().selectedIds;
    expect(ids.has(1)).toBe(true);
    expect(ids.has(2)).toBe(true);
    expect(ids.has(3)).toBe(true);
    expect(ids.size).toBe(3);
  });

  it("取消选中后 selectionMode 仍保持", () => {
    useSelectionStore.getState().toggleSelect(1);
    useSelectionStore.getState().toggleSelect(2);
    useSelectionStore.getState().toggleSelect(1);
    expect(useSelectionStore.getState().selectionMode).toBe(true);
  });
});

describe("selectAll / exitSelectionMode", () => {
  it("全选所有 tab", () => {
    const allIds = [1, 2, 3, 4, 5];
    useSelectionStore.getState().selectAll(allIds);
    const ids = useSelectionStore.getState().selectedIds;
    expect(ids.size).toBe(5);
    expect(useSelectionStore.getState().selectionMode).toBe(true);
  });

  it("exitSelectionMode 清空选中并退出多选模式", () => {
    useSelectionStore.getState().selectAll([1, 2, 3]);
    useSelectionStore.getState().exitSelectionMode();
    expect(useSelectionStore.getState().selectedIds.size).toBe(0);
    expect(useSelectionStore.getState().selectionMode).toBe(false);
    expect(useSelectionStore.getState().lastClickedId).toBeNull();
  });
});

describe("范围选择（Shift+Click）", () => {
  it("Shift 点击选择从上次点击到当前 tab 之间的所有 tab", () => {
    const allTabIds = [10, 20, 30, 40, 50];
    // 先点击 10
    useSelectionStore.getState().toggleSelect(10, false, allTabIds);
    // Shift 点击 40
    useSelectionStore.getState().toggleSelect(40, true, allTabIds);
    const ids = useSelectionStore.getState().selectedIds;
    expect(ids.has(10)).toBe(true);
    expect(ids.has(20)).toBe(true);
    expect(ids.has(30)).toBe(true);
    expect(ids.has(40)).toBe(true);
    expect(ids.has(50)).toBe(false);
  });

  it("反向范围选也能正确选择", () => {
    const allTabIds = [10, 20, 30, 40, 50];
    useSelectionStore.getState().toggleSelect(40, false, allTabIds);
    useSelectionStore.getState().toggleSelect(10, true, allTabIds);
    const ids = useSelectionStore.getState().selectedIds;
    expect(ids.has(10)).toBe(true);
    expect(ids.has(20)).toBe(true);
    expect(ids.has(30)).toBe(true);
    expect(ids.has(40)).toBe(true);
    expect(ids.has(50)).toBe(false);
  });

  it("lastClickedId 为 null 时 Shift 点击退化为普通 toggle", () => {
    const allTabIds = [10, 20, 30];
    useSelectionStore.getState().toggleSelect(20, true, allTabIds);
    expect(useSelectionStore.getState().selectedIds.size).toBe(1);
    expect(useSelectionStore.getState().selectedIds.has(20)).toBe(true);
  });
});

describe("clearSelection", () => {
  it("清空选中但保留 selectionMode", () => {
    useSelectionStore.getState().selectAll([1, 2, 3]);
    useSelectionStore.getState().clearSelection();
    expect(useSelectionStore.getState().selectedIds.size).toBe(0);
    expect(useSelectionStore.getState().selectionMode).toBe(true);
  });
});

describe("resetAfterBatch", () => {
  it("批量操作后清空选中并退出多选模式", () => {
    useSelectionStore.getState().selectAll([1, 2, 3]);
    useSelectionStore.getState().resetAfterBatch();
    expect(useSelectionStore.getState().selectedIds.size).toBe(0);
    expect(useSelectionStore.getState().selectionMode).toBe(false);
    expect(useSelectionStore.getState().lastClickedId).toBeNull();
  });
});

describe("removeIds — 与 tab 列表同步", () => {
  it("移除已删除 tab 的选中态", () => {
    useSelectionStore.getState().selectAll([1, 2, 3, 4]);
    useSelectionStore.getState().removeIds([2, 4]);
    const ids = useSelectionStore.getState().selectedIds;
    expect(ids.has(1)).toBe(true);
    expect(ids.has(2)).toBe(false);
    expect(ids.has(3)).toBe(true);
    expect(ids.has(4)).toBe(false);
  });

  it("移除所有选中 tab 后自动退出多选模式", () => {
    useSelectionStore.getState().selectAll([1, 2]);
    useSelectionStore.getState().removeIds([1, 2]);
    expect(useSelectionStore.getState().selectedIds.size).toBe(0);
    expect(useSelectionStore.getState().selectionMode).toBe(false);
  });

  it("lastClickedId 被移除时重置为 null", () => {
    useSelectionStore.getState().toggleSelect(1);
    useSelectionStore.getState().removeIds([1]);
    expect(useSelectionStore.getState().lastClickedId).toBeNull();
  });
});

describe("isSelected", () => {
  it("返回选中状态", () => {
    useSelectionStore.getState().toggleSelect(42);
    expect(useSelectionStore.getState().isSelected(42)).toBe(true);
    expect(useSelectionStore.getState().isSelected(99)).toBe(false);
  });
});

describe("enterSelectionMode", () => {
  it("进入多选模式", () => {
    useSelectionStore.getState().enterSelectionMode();
    expect(useSelectionStore.getState().selectionMode).toBe(true);
  });
});
