/**
 * 归档服务 - 统一入口
 *
 * 将归档服务按职责拆分为五个子模块：
 * - archive-utils：工具函数
 * - archive-storage：存储路由与 IDB 降级
 * - archive-operations：归档操作
 * - archive-restore：恢复操作
 * - archive-session-management：会话 CRUD
 *
 * 本文件为 barrel export，保持与原 archive-service.ts 相同的公共 API。
 */

// 存储路由
export { initArchiveStorage, getArchivedSessions, saveSessions } from "./archive-storage";

// 归档操作
export {
  archiveAllTabs,
  archiveCurrentWindowTabs,
  archiveSelectedTabs,
} from "./archive-operations";

// 恢复操作
export { restoreSession } from "./archive-restore";
export type { RestoreStrategy, RestoreOutcome } from "./archive-restore";

// 会话管理
export {
  deleteSession,
  renameSession,
  mergeSessions,
  exportSingleSession,
  createAutoSnapshot,
} from "./archive-session-management";

// 工具函数（仅内部使用，通常不对外暴露；如有需要可取消注释）
// export { isArchivableTab, toArchivedTab, buildDefaultSessionName, canonicalUrlKey } from './archive-utils';
