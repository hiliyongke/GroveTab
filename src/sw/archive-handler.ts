/**
 * SW 归档处理器 — 提取 context menu 和 commands 共用的归档逻辑
 *
 * 将原先在 `index.ts` 中重复 ~30 行的归档代码收敛为一个函数，
 * 避免两处逻辑分叉或其中一边漏修。
 */

/**
 * 归档当前窗口所有可归档标签页
 *
 * 流程（原子性保障）：
 *   1. 查询当前窗口所有 tab，过滤掉不可归档的（chrome://、扩展自身、pinned、incognito）
 *   2. 构建 ArchivedSession 并写入 chrome.storage.local
 *   3. 关闭已归档的 tab
 *
 * 注：SW 中无法使用 i18n 的 translate()（无 React 上下文），
 * 会话名使用 chrome.i18n.getMessage() 或 fallback 英文。
 */
export async function archiveCurrentWindowTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({ currentWindow: true });

  const toSave = tabs.filter((tab) => {
    const url = tab.url || tab.pendingUrl || '';
    if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('about:')) return false;
    if (tab.pinned) return false;
    if (tab.incognito) return false;
    return true;
  });

  if (toSave.length === 0) return;

  const { nanoid } = await import('nanoid');
  const dateStr = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const sessionName = chrome.i18n.getMessage('archive_session_name', [dateStr])
    || `Session ${dateStr}`;

  const session = {
    id: nanoid(10),
    name: sessionName,
    createdAt: Date.now(),
    tabs: toSave.map((tab) => ({
      url: tab.url || tab.pendingUrl || '',
      title: tab.title || '',
      favIconUrl: tab.favIconUrl || '',
      hostname: (() => { try { return new URL(tab.url || '').hostname; } catch { return ''; } })(),
      pinned: tab.pinned,
    })),
    tabCount: toSave.length,
  };

  // 原子写入：先存快照再关标签
  const result = await chrome.storage.local.get('canopy_sessions');
  const sessions: unknown[] = Array.isArray(result.canopy_sessions) ? result.canopy_sessions : [];
  sessions.unshift(session);
  await chrome.storage.local.set({ canopy_sessions: sessions });

  // 关闭已归档标签
  const tabIds = toSave.map((t) => t.id).filter((id): id is number => id !== undefined);
  if (tabIds.length > 0) {
    await chrome.tabs.remove(tabIds);
  }
}
