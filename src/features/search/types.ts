import type { LiveTab, SearchEngineId } from "@/shared/types";
import type { HistorySearchEntry } from "@/chrome";
import type { ClosedTabRecord } from "@/shared/types";

export type SuggestionSource = "recent" | "hot";

export type UniversalSearchItem =
  | {
      id: string;
      type: "tab";
      title: string;
      subtitle: string;
      tab: LiveTab;
      badge?: string;
      matchedTags?: string[];
    }
  | {
      id: string;
      type: "history";
      title: string;
      subtitle: string;
      entry: HistorySearchEntry;
    }
  | {
      id: string;
      type: "closed";
      title: string;
      subtitle: string;
      record: ClosedTabRecord;
    }
  | {
      id: string;
      type: "suggestion";
      title: string;
      subtitle: string;
      keyword: string;
      source: SuggestionSource;
    }
  | {
      id: string;
      type: "web";
      title: string;
      subtitle: string;
      query: string;
      engineId: SearchEngineId;
    }
  | {
      id: string;
      type: "permission";
      title: string;
      subtitle: string;
    }
  | {
      id: string;
      type: "command";
      title: string;
      subtitle: string;
      commandId: "open-history";
    }
  | {
      id: string;
      type: "archive";
      title: string;
      subtitle: string;
      /** 归档会话名称 */
      sessionName: string;
      /** 归档会话 ID（用于恢复） */
      sessionId: string;
      /** 标签页 URL */
      url: string;
    }
  | {
      id: string;
      type: "bookmark";
      title: string;
      subtitle: string;
      url: string;
      folderPath?: string;
    };

export type IconRole = "tab" | "history" | "web" | "hot" | "recent" | "permission" | "search";

export interface SearchSection {
  key: string;
  title: string;
  items: UniversalSearchItem[];
}
