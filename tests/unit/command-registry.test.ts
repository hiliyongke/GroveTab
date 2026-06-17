import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/shared/i18n/core", () => ({
  translate: vi.fn((key: string) => key),
}));

const updateSettings = vi.fn().mockResolvedValue(undefined);

vi.mock("@/store", () => ({
  useSettingsStore: {
    getState: vi.fn(() => ({ updateSettings })),
  },
}));

import { createViewCommands } from "@/features/command-palette";

beforeEach(() => {
  updateSettings.mockClear();
});

describe("createViewCommands", () => {
  it("只把 5 个产品主入口作为一级视图命令暴露", () => {
    const commands = createViewCommands(vi.fn());
    const topLevelIds = commands
      .filter((cmd) => cmd.id.startsWith("view.switch"))
      .map((cmd) => cmd.id);

    expect(topLevelIds).toEqual([
      "view.switchTabs",
      "view.switchBookmarks",
      "view.switchSessions",
      "view.switchTrending",
      "view.switchDevtools",
    ]);
  });

  it("内部标签页能力通过 tabsSubView 打开", () => {
    const switchView = vi.fn();
    const commands = createViewCommands(switchView);
    const timeline = commands.find((cmd) => cmd.id === "tabs.openTimeline");

    timeline?.execute();

    expect(updateSettings).toHaveBeenCalledWith({ defaultView: "tabs", tabsSubView: "timeline" });
    expect(switchView).toHaveBeenCalledWith("tabs");
  });

  it("归档/回收站/历史通过会话子视图打开", () => {
    const switchView = vi.fn();
    const commands = createViewCommands(switchView);
    const trash = commands.find((cmd) => cmd.id === "sessions.openTrash");

    trash?.execute();

    expect(updateSettings).toHaveBeenCalledWith({
      defaultView: "sessions",
      sessionsSubView: "trash",
    });
    expect(switchView).toHaveBeenCalledWith("sessions");
  });
});
