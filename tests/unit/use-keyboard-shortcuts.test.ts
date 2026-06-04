/**
 * useKeyboardShortcuts 单元测试
 *
 * 覆盖：
 * - ⌘1..⌘7 触发对应视图切换
 * - 重复按已激活视图的快捷键不会再调一次回调
 * - 输入框 / contenteditable 中 ⌘ 系快捷键仍生效（与系统级一致）
 * - 输入框中 Esc 不会冒泡到 onCancel（避免误触）
 * - Esc 触发 onCancel
 * - enabled=false 时所有按键被忽略
 * - getViewShortcut / getShortcutDescription 行为
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  useKeyboardShortcuts,
  getViewShortcut,
  getShortcutDescription,
} from "@/shared/hooks/use-keyboard-shortcuts";

function fireKey(
  key: string,
  init: Partial<KeyboardEventInit> & { target?: EventTarget } = {},
): KeyboardEvent {
  const ev = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  if (init.target !== undefined) {
    Object.defineProperty(ev, "target", { value: init.target });
  }
  window.dispatchEvent(ev);
  return ev;
}

describe("useKeyboardShortcuts — view switching", () => {
  let onSwitchView: ReturnType<typeof vi.fn>;
  let onCancel: ReturnType<typeof vi.fn>;
  let unmounts: Array<() => void> = [];

  beforeEach(() => {
    onSwitchView = vi.fn();
    onCancel = vi.fn();
    unmounts = [];
  });

  afterEach(() => {
    for (const u of unmounts) u();
    vi.restoreAllMocks();
  });

  function mount(activeView: "tabs" | "timeline" | "archive") {
    const r = renderHook(() => useKeyboardShortcuts({ activeView, onSwitchView, onCancel }));
    unmounts.push(r.unmount);
    return r;
  }

  it("⌘1 切换到 tabs", () => {
    mount("timeline");
    fireKey("1", { metaKey: true });
    expect(onSwitchView).toHaveBeenCalledWith("tabs");
  });

  it("⌘2 切换到 tabgroup", () => {
    mount("tabs");
    fireKey("2", { metaKey: true });
    expect(onSwitchView).toHaveBeenCalledWith("tabgroup");
  });

  it("⌘6 切换到 bookmarks", () => {
    mount("tabs");
    fireKey("6", { metaKey: true });
    expect(onSwitchView).toHaveBeenCalledWith("bookmarks");
  });

  it("Ctrl+1 与 ⌘1 等价（跨平台）", () => {
    mount("timeline");
    fireKey("1", { ctrlKey: true });
    expect(onSwitchView).toHaveBeenCalledWith("tabs");
  });

  it("当前视图与目标视图相同时不触发回调", () => {
    mount("tabs");
    fireKey("1", { metaKey: true });
    expect(onSwitchView).not.toHaveBeenCalled();
  });

  it("⌘0 不在范围内不会触发", () => {
    mount("tabs");
    fireKey("0", { metaKey: true });
    expect(onSwitchView).not.toHaveBeenCalled();
  });

  it("无修饰键的数字键不会触发", () => {
    mount("tabs");
    fireKey("3");
    expect(onSwitchView).not.toHaveBeenCalled();
  });
});

describe("useKeyboardShortcuts — input field suppression", () => {
  let onSwitchView: ReturnType<typeof vi.fn>;
  let onCancel: ReturnType<typeof vi.fn>;
  let unmount: () => void = () => {};

  beforeEach(() => {
    onSwitchView = vi.fn();
    onCancel = vi.fn();
  });

  afterEach(() => {
    unmount();
  });

  it("INPUT 焦点中 ⌘1 仍生效（与系统级一致）", () => {
    const r = renderHook(() =>
      useKeyboardShortcuts({ activeView: "timeline", onSwitchView, onCancel }),
    );
    unmount = r.unmount;
    const input = document.createElement("input");
    document.body.appendChild(input);
    try {
      fireKey("1", { metaKey: true, target: input });
      expect(onSwitchView).toHaveBeenCalledWith("tabs");
    } finally {
      document.body.removeChild(input);
    }
  });

  it("INPUT 焦点中 Esc 不会触发 onCancel", () => {
    const r = renderHook(() =>
      useKeyboardShortcuts({ activeView: "tabs", onSwitchView, onCancel }),
    );
    unmount = r.unmount;
    const input = document.createElement("input");
    document.body.appendChild(input);
    try {
      fireKey("Escape", { target: input });
      expect(onCancel).not.toHaveBeenCalled();
    } finally {
      document.body.removeChild(input);
    }
  });

  it("contenteditable 中无修饰键被抑制", () => {
    const r = renderHook(() =>
      useKeyboardShortcuts({ activeView: "tabs", onSwitchView, onCancel }),
    );
    unmount = r.unmount;
    const div = document.createElement("div");
    div.setAttribute("contenteditable", "true");
    document.body.appendChild(div);
    try {
      fireKey("Escape", { target: div });
      expect(onCancel).not.toHaveBeenCalled();
    } finally {
      document.body.removeChild(div);
    }
  });
});

describe("useKeyboardShortcuts — Esc & enabled flag", () => {
  it("Esc 在非编辑场景调用 onCancel", () => {
    const onCancel = vi.fn();
    const { unmount } = renderHook(() =>
      useKeyboardShortcuts({
        activeView: "tabs",
        onSwitchView: vi.fn(),
        onCancel,
      }),
    );
    fireKey("Escape");
    expect(onCancel).toHaveBeenCalled();
    unmount();
  });

  it("enabled=false 时所有快捷键被忽略", () => {
    const onSwitchView = vi.fn();
    const onCancel = vi.fn();
    const { unmount } = renderHook(() =>
      useKeyboardShortcuts({
        activeView: "tabs",
        onSwitchView,
        onCancel,
        enabled: false,
      }),
    );
    fireKey("1", { metaKey: true });
    fireKey("Escape");
    expect(onSwitchView).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    unmount();
  });
});

describe("getViewShortcut / getShortcutDescription", () => {
  it("getViewShortcut 返回基于 1 的索引", () => {
    expect(getViewShortcut("tabs")).toBe(1);
    expect(getViewShortcut("archive")).toBe(9);
  });

  it("getShortcutDescription 包含 ⌘ / Ctrl+ 前缀", () => {
    const desc = getShortcutDescription("tabs");
    expect(desc.endsWith("1")).toBe(true);
    expect(desc.length).toBeGreaterThan(1);
  });
});
