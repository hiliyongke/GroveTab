/**
 * PanelStack 单元测试
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  usePanelStackStore,
  type PanelDescriptor,
} from "@/shared/panels/panel-stack-store";

// 每个测试前重置 store
beforeEach(() => {
  usePanelStackStore.setState({ stack: [] });
});

// ── push ──────────────────────────────────────────────────────────────────────

describe("push", () => {
  it("推入面板到空栈", () => {
    usePanelStackStore.getState().push({ id: "search" });
    expect(usePanelStackStore.getState().stack).toEqual([{ id: "search" }]);
  });

  it("推入多个面板", () => {
    usePanelStackStore.getState().push({ id: "settings" });
    usePanelStackStore.getState().push({ id: "search" });
    expect(usePanelStackStore.getState().stack).toEqual([
      { id: "settings" },
      { id: "search" },
    ]);
  });

  it("推入已有面板时先移除旧的（避免重复）", () => {
    usePanelStackStore.getState().push({ id: "settings", subId: "appearance" });
    usePanelStackStore.getState().push({ id: "search" });
    usePanelStackStore.getState().push({ id: "settings", subId: "about" });
    const stack = usePanelStackStore.getState().stack;
    expect(stack).toEqual([{ id: "search" }, { id: "settings", subId: "about" }]);
    expect(stack.length).toBe(2);
  });

  it("推入带 context 的面板", () => {
    usePanelStackStore.getState().push({ id: "search", context: { query: "test" } });
    expect(usePanelStackStore.getState().stack[0]?.context).toEqual({ query: "test" });
  });
});

// ── pop ───────────────────────────────────────────────────────────────────────

describe("pop", () => {
  it("空栈 pop 返回 null", () => {
    expect(usePanelStackStore.getState().pop()).toBeNull();
    expect(usePanelStackStore.getState().stack).toEqual([]);
  });

  it("pop 返回栈顶并移除", () => {
    usePanelStackStore.getState().push({ id: "search" });
    usePanelStackStore.getState().push({ id: "settings" });
    const popped = usePanelStackStore.getState().pop();
    expect(popped).toEqual({ id: "settings" });
    expect(usePanelStackStore.getState().stack).toEqual([{ id: "search" }]);
  });
});

// ── replace ───────────────────────────────────────────────────────────────────

describe("replace", () => {
  it("空栈 replace 等效 push", () => {
    usePanelStackStore.getState().replace({ id: "search" });
    expect(usePanelStackStore.getState().stack).toEqual([{ id: "search" }]);
  });

  it("替换栈顶面板", () => {
    usePanelStackStore.getState().push({ id: "settings" });
    usePanelStackStore.getState().push({ id: "search" });
    usePanelStackStore.getState().replace({ id: "insights" });
    expect(usePanelStackStore.getState().stack).toEqual([
      { id: "settings" },
      { id: "insights" },
    ]);
  });

  it("替换时移除栈中已有的同 ID 面板", () => {
    usePanelStackStore.getState().push({ id: "settings", subId: "appearance" });
    usePanelStackStore.getState().push({ id: "search" });
    usePanelStackStore.getState().replace({ id: "settings", subId: "about" });
    expect(usePanelStackStore.getState().stack).toEqual([
      { id: "settings", subId: "about" },
    ]);
  });
});

// ── clear ─────────────────────────────────────────────────────────────────────

describe("clear", () => {
  it("清空非空栈", () => {
    usePanelStackStore.getState().push({ id: "search" });
    usePanelStackStore.getState().push({ id: "settings" });
    usePanelStackStore.getState().clear();
    expect(usePanelStackStore.getState().stack).toEqual([]);
  });

  it("空栈 clear 无副作用", () => {
    usePanelStackStore.getState().clear();
    expect(usePanelStackStore.getState().stack).toEqual([]);
  });
});

// ── close ─────────────────────────────────────────────────────────────────────

describe("close", () => {
  it("关闭指定面板（从栈中移除）", () => {
    usePanelStackStore.getState().push({ id: "settings" });
    usePanelStackStore.getState().push({ id: "search" });
    usePanelStackStore.getState().close("settings");
    expect(usePanelStackStore.getState().stack).toEqual([{ id: "search" }]);
  });

  it("关闭栈顶面板", () => {
    usePanelStackStore.getState().push({ id: "search" });
    usePanelStackStore.getState().close("search");
    expect(usePanelStackStore.getState().stack).toEqual([]);
  });

  it("关闭不在栈中的面板无副作用", () => {
    usePanelStackStore.getState().push({ id: "search" });
    usePanelStackStore.getState().close("insights");
    expect(usePanelStackStore.getState().stack).toEqual([{ id: "search" }]);
  });
});

// ── isOpen ────────────────────────────────────────────────────────────────────

describe("isOpen", () => {
  it("面板在栈中 → true", () => {
    usePanelStackStore.getState().push({ id: "search" });
    expect(usePanelStackStore.getState().isOpen("search")).toBe(true);
  });

  it("面板不在栈中 → false", () => {
    expect(usePanelStackStore.getState().isOpen("search")).toBe(false);
  });
});

// ── getTop ────────────────────────────────────────────────────────────────────

describe("getTop", () => {
  it("空栈 → null", () => {
    expect(usePanelStackStore.getState().getTop()).toBeNull();
  });

  it("非空栈 → 栈顶", () => {
    usePanelStackStore.getState().push({ id: "settings" });
    usePanelStackStore.getState().push({ id: "search" });
    expect(usePanelStackStore.getState().getTop()).toEqual({ id: "search" });
  });
});

// ── getDepth ──────────────────────────────────────────────────────────────────

describe("getDepth", () => {
  it("空栈 → 0", () => {
    expect(usePanelStackStore.getState().getDepth()).toBe(0);
  });

  it("2 层栈 → 2", () => {
    usePanelStackStore.getState().push({ id: "settings" });
    usePanelStackStore.getState().push({ id: "search" });
    expect(usePanelStackStore.getState().getDepth()).toBe(2);
  });
});

// ── 完整操作流程 ──────────────────────────────────────────────────────────────

describe("complete workflow", () => {
  it("push → push → pop → replace → close", () => {
    const store = usePanelStackStore.getState();

    store.push({ id: "settings", subId: "appearance" });
    store.push({ id: "insights" });
    expect(store.getDepth()).toBe(2);

    store.pop();
    expect(store.getTop()).toEqual({ id: "settings", subId: "appearance" });

    store.replace({ id: "settings", subId: "about" });
    expect(store.getTop()).toEqual({ id: "settings", subId: "about" });

    store.close("settings");
    expect(store.getDepth()).toBe(0);
    expect(store.getTop()).toBeNull();
  });
});
