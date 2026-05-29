/**
 * CommandPalette 模块导出
 */

export { CommandPalette } from "./CommandPalette";
export {
  registerCommands,
  unregisterCommand,
  getAvailableCommands,
  getCommand,
  createViewCommands,
  createPanelCommands,
  createSettingsCommands,
  createSpaceCommands,
  type CommandDef,
  type CommandCategory,
  type SpaceDef,
} from "./command-registry";
export { useCommandSearch, type SearchResult } from "./use-command-search";
