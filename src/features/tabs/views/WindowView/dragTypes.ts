import type { LiveTab } from "@/shared/types";

export type WindowDragData =
  | {
      kind: "tab";
      tab: LiveTab;
    }
  | {
      kind: "window-card";
      windowId: number;
    };

export type WindowDropData =
  | {
      kind: "window";
      windowId: number;
      incognito: boolean;
    }
  | {
      kind: "group";
      windowId: number;
      groupId: number;
      incognito: boolean;
    }
  | {
      kind: "ungrouped";
      windowId: number;
      incognito: boolean;
    };
