/**
 * SearchBox 模块导出
 *
 * 保持向后兼容的导出结构。
 * 从单一文件（SearchBox.tsx, 1375行）拆分为模块化结构。
 */

// 导出主组件
export { SearchBox } from "./SearchBox";

// 导出类型（供其他模块使用）
export type {
  SearchBoxProps,
  UniversalSearchItem,
  SearchSection,
  ShortcutHint,
  SuggestionSource,
  SearchIndexLike,
  SearchSettingsSnapshot,
} from "./types";

// 导出工具函数（供其他模块使用）
export {
  cx,
  cssVars,
  normalizeMetadataKey,
  normalizeSearchText,
  getItemIconMeta,
} from "./utils/searchUtils";
export { renderHighlightedText } from "./utils/highlightUtils";

// 导出组件（供其他模块使用）
export { Kbd } from "./components/Kbd";
export { SearchResultItem } from "./components/SearchResultItem";
export { SearchResultList } from "./components/SearchResultList";
export { SearchFooter } from "./components/SearchFooter";
export { SearchEngineSelector } from "./components/SearchEngineSelector";

// 导出 Hooks（供其他模块使用）
export { useSearchIndex } from "./hooks/useSearchIndex";
export { useSearchHistory } from "./hooks/useSearchHistory";
export { useKeyboardNavigation } from "./hooks/useKeyboardNavigation";
