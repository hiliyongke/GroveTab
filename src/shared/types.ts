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
  hostname: string;
  isCurrentWindow: boolean;
}

/** Special URL classification */
export type SpecialUrlType = 'chrome' | 'file' | 'about' | 'devtools' | 'edge' | 'normal';

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
  overrideNewTab: boolean;
  defaultView: 'domain' | 'timeline' | 'compact' | 'grid' | 'freq' | 'kanban';
  theme: 'light' | 'dark' | 'system';
  gradientPreset: 'aurora' | 'sunrise' | 'deepspace' | 'custom';
  customGradient?: string;
  showIncognito: boolean;
  language: 'zh-CN' | 'en';
}

// ── Undo System ───────────────────────────────────────

export interface ClosedTabSnapshot {
  url: string;
  title: string;
  favIconUrl: string;
  windowId: number;
  pinned: boolean;
}

export interface UndoRecord {
  id: string;
  createdAt: number;
  tabs: ClosedTabSnapshot[];
  description: string;
  expired: boolean;
}

// ── Archive / Sessions ────────────────────────────────

/** An archived tab entry */
export interface ArchivedTab {
  url: string;
  title: string;
  favIconUrl: string;
  hostname: string;
  pinned: boolean;
}

/** An archived session (group of tabs saved at once) */
export interface ArchivedSession {
  id: string;
  name: string;
  createdAt: number;
  tabs: ArchivedTab[];
  /** Tab count for quick display */
  tabCount: number;
}
