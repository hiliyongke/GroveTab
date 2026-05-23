/**
 * Pure utility functions and shared types for search logic.
 * Extracted from SearchBox.tsx to enable reuse and testability.
 */

import type { LiveTab, SearchEngineId, SearchScopeField } from '@/shared/types';
import type { ClosedTabRecord } from '@/shared/types';
import type { HistorySearchEntry } from '@/chrome';
import type { IconRole } from '@/shared/utils/icon-colors';

/** Default search scope fields when user hasn't configured custom scope */
export const DEFAULT_SEARCH_SCOPE: SearchScopeField[] = ['title', 'hostname', 'url'];

/** Pinyin match function signature, loaded asynchronously from @/shared/utils/pinyin */
export type PinyinMatchFn = (text: string, query: string) => boolean;

/** Minimal interface for a text search index (decoupled from MiniSearch) */
export interface SearchIndexLike {
  search: (query: string) => Array<{ id: number }>;
}

/** Suggestion item source type */
export type SuggestionSource = 'recent' | 'hot';

/**
 * Universal search item — discriminated union of all searchable item types.
 * Used throughout the search feature for rendering and action handling.
 */
export type UniversalSearchItem =
  | {
      id: string;
      type: 'tab';
      title: string;
      subtitle: string;
      tab: LiveTab;
      badge?: string;
      matchedTags?: string[];
    }
  | {
      id: string;
      type: 'history';
      title: string;
      subtitle: string;
      entry: HistorySearchEntry;
    }
  | {
      id: string;
      type: 'closed';
      title: string;
      subtitle: string;
      record: ClosedTabRecord;
    }
  | {
      id: string;
      type: 'suggestion';
      title: string;
      subtitle: string;
      keyword: string;
      source: SuggestionSource;
    }
  | {
      id: string;
      type: 'web';
      title: string;
      subtitle: string;
      query: string;
      engineId: SearchEngineId;
    }
  | {
      id: string;
      type: 'permission';
      title: string;
      subtitle: string;
    }
  | {
      /** Quick action item (e.g. "Open history panel"), extensible via commandId */
      id: string;
      type: 'command';
      title: string;
      subtitle: string;
      commandId: 'open-history';
    };

/**
 * Normalize URL exactly like metadata-slice so search can resolve tab tags reliably.
 * Strips hash and trailing slashes for consistent key matching.
 * @param url
 * @returns {void} 无返回值
 */
export function normalizeMetadataKey(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return url;
  }
}

/**
 * Normalize search text by trimming and converting to lowercase.
 * @param text
 * @returns {void} 无返回值
 */
export function normalizeSearchText(text: string): string {
  return text.trim().toLowerCase();
}

/**
 * Get the semantic icon role for a search item, used for icon color mapping.
 * The actual icon component should be rendered by the component based on item.type + iconRole.
 * @param item
 * @returns {void} 无返回值
 */
export function getItemIconRole(item: UniversalSearchItem): IconRole {
  switch (item.type) {
    case 'tab':
      return 'tab';
    case 'history':
      return 'history';
    case 'closed':
      return 'history';
    case 'command':
      return 'history';
    case 'web':
      return 'web';
    case 'permission':
      return 'permission';
    case 'suggestion':
      return item.source === 'hot' ? 'hot' : 'recent';
    default:
      return 'search';
  }
}

/** A segment of highlighted text, either matched or plain */
export interface HighlightPart {
  text: string;
  isMatch: boolean;
}

/**
 * Split text into segments based on query matches, returning data for highlighting.
 * Pure function alternative to renderHighlightedText — the component renders the actual JSX
 * using the returned HighlightPart array.
 *
 * @param text - The full text to highlight within
 * @param query - The search query to match against
 * @returns Array of text segments with match flags
 */
export function getHighlightParts(text: string, query: string): HighlightPart[] {
  const normalizedQuery = query.trim();
  if (normalizedQuery === '' || text === '') {
    return [{ text, isMatch: false }];
  }

  const escaped = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matcher = new RegExp(`(${escaped})`, 'ig');
  const parts = text.split(matcher);

  return parts.map((part) => ({
    text: part,
    isMatch:
      part.localeCompare(normalizedQuery, undefined, { sensitivity: 'accent' }) === 0
      || part.toLowerCase() === normalizedQuery.toLowerCase(),
  }));
}
