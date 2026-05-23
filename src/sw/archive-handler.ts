/**
 * SW 归档处理器。
 *
 * Service Worker 只保留一个极薄的转发层，真正的归档实现统一收敛到
 * `archive-service`，避免 Popup / SW / UI 三处逻辑继续分叉。
 */

import { archiveCurrentWindowTabs as archiveCurrentWindowTabsFromService } from '@/services/archive';

/**
 * 归档当前窗口所有可归档标签页
 *
 * 转发调用 services/archive 中的真正实现，
 * 保持 SW 层轻量。
 *
 * @returns 无返回值（异步操作）
 */
export async function archiveCurrentWindowTabs(): Promise<void> {
  await archiveCurrentWindowTabsFromService();
}
