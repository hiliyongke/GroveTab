/**
 * Canopy — Chrome Extension Type Definitions
 * Shared types for the entire extension.
 */

/** Represents a live (currently open) browser tab */
export interface LiveTab {
  id: number;
  url: string;
  title: string;
  favIconUrl: string;
  windowId: number;
  incognito: boolean;
  pinned: boolean;
  audible: boolean;
  groupId: number;
  lastAccessed: number;
  /** Extracted hostname from URL */
  hostname: string;
  /** Tab belongs to the current window or not */
  isCurrentWindow: boolean;
}

/** Special URL classification */
export type SpecialUrlType =
  | 'chrome'       // chrome://, chrome-extension://
  | 'file'         // file://
  | 'about'        // about:blank, about:newtab
  | 'devtools'     // devtools://
  | 'edge'         // edge://
  | 'normal';      // Regular http(s) URL

/** Window information */
export interface WindowInfo {
  id: number;
  focused: boolean;
  type: string;
  incognito: boolean;
  tabsCount: number;
}

/** Broadcast message types from SW to new tab pages */
export type SwBroadcastType =
  | 'tab-created'
  | 'tab-updated'
  | 'tab-removed'
  | 'tab-activated'
  | 'tab-moved'
  | 'window-focus-changed';

export interface SwBroadcastMessage {
  type: SwBroadcastType;
  payload: Record<string, unknown>;
  timestamp: number;
}

/** Storage keys for partitioned storage */
export type StorageKey =
  | 'canopy_tabs'
  | 'canopy_sessions'
  | 'canopy_settings'
  | 'canopy_tags'
  | 'canopy_notes'
  | 'canopy_pins'
  | 'canopy_undo'
  | 'canopy_stats'
  | 'canopy_snapshots'
  | 'canopy_meta';

/** Storage metadata */
export interface StorageMeta {
  schemaVersion: number;
  createdAt: number;
  updatedAt: number;
}

/** User settings */
export interface UserSettings {
  /** Override new tab page */
  overrideNewTab: boolean;
  /** Default view mode */
  defaultView: 'domain' | 'timeline' | 'compact' | 'grid' | 'freq' | 'kanban';
  /** Theme preference */
  theme: 'light' | 'dark' | 'system';
  /** Gradient preset */
  gradientPreset: 'aurora' | 'sunrise' | 'deepspace' | 'custom';
  /** Show incognito tabs */
  showIncognito: boolean;
  /** Language */
  language: 'zh-CN' | 'en';
}
