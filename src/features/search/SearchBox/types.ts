/**
 * SearchBox 相关类型定义
 */

import type { LiveTab, SearchEngineId, SearchScopeField, TrendingCache } from "@/shared/types";
import type { CustomSearchEngine } from "@/shared/types/settings";
import type { HistorySearchEntry } from "@/chrome";
import type { ClosedTabRecord } from "@/shared/types";

export type {
  LiveTab,
  SearchEngineId,
  SearchScopeField,
  TrendingCache,
  CustomSearchEngine,
  HistorySearchEntry,
  ClosedTabRecord,
};

export type PinyinMatchFn = (text: string, query: string) => boolean;

export interface SearchIndexLike {
  search: (query: string) => Array<{ id: number }>;
}

export interface SearchBoxProps {
  /** 受控：是否打开 */
  open: boolean;
  /** 受控：开关切换回调 */
  onOpenChange: (open: boolean) => void;
  /** 点击「查看全部历史」时的回调；未传时不展示该入口 */
  onOpenHistory?: () => void;
}

export interface SearchSettingsSnapshot {
  searchCustomEngines?: CustomSearchEngine[];
}

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
      /** 快捷动作，如「打开历史面板」，取代于临时仅有一个 commandId 但保留可扩展能力 */
      id: string;
      type: "command";
      title: string;
      subtitle: string;
      commandId: "open-history";
    };

export interface SearchSection {
  key: string;
  title: string;
  items: UniversalSearchItem[];
}

export interface ShortcutHint {
  id: string;
  keys: string[];
  label: string;
}

export type HotKeywordSource = "local" | "preset" | "trending" | "off";
