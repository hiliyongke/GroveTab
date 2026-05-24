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
    };

export type IconRole = "tab" | "history" | "web" | "hot" | "recent" | "permission" | "search";

export interface SearchSection {
  key: string;
  title: string;
  items: UniversalSearchItem[];
}
