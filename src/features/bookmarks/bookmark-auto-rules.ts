/**
 * bookmark-auto-rules.ts —— 书签自动分类规则服务（需求 5.2）
 *
 * 功能：
 *   - 定义规则数据结构（URLPattern 匹配 + 目标文件夹）
 *   - 持久化规则到 chrome.storage.local
 *   - 对新书签执行规则匹配，自动移动到目标文件夹
 */

import { storageGet, storageSet } from "@/chrome";
import { moveBookmark, createBookmark, getBookmarkTree } from "@/chrome/bookmarks";
import type { BookmarkNode } from "@/chrome/bookmarks";
import { STORAGE_KEYS } from "@/shared/config/storage-keys";

/** 单条自动分类规则 */
export interface BookmarkAutoRule {
  id: string;
  /** 规则名称（用户自定义） */
  name: string;
  /** URLPattern 字符串，如 "https://github.com/*" */
  pattern: string;
  /** 目标文件夹 ID（chrome.bookmarks 节点 ID） */
  targetFolderId: string;
  /** 目标文件夹名称（仅展示用，不参与匹配） */
  targetFolderName: string;
  /** 是否启用 */
  enabled: boolean;
  /** 创建时间 */
  createdAt: number;
}

/** 加载所有规则 */
export async function getBookmarkAutoRules(): Promise<BookmarkAutoRule[]> {
  const data = await storageGet<BookmarkAutoRule[]>(STORAGE_KEYS.bookmarkAutoRules);
  return data ?? [];
}

/** 保存规则列表 */
export async function saveBookmarkAutoRules(rules: BookmarkAutoRule[]): Promise<void> {
  await storageSet(STORAGE_KEYS.bookmarkAutoRules, rules);
}

/** 添加一条规则 */
export async function addBookmarkAutoRule(
  rule: Omit<BookmarkAutoRule, "id" | "createdAt">,
): Promise<BookmarkAutoRule> {
  const rules = await getBookmarkAutoRules();
  const newRule: BookmarkAutoRule = {
    ...rule,
    id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
  };
  rules.push(newRule);
  await saveBookmarkAutoRules(rules);
  return newRule;
}

/** 删除一条规则 */
export async function deleteBookmarkAutoRule(id: string): Promise<void> {
  const rules = await getBookmarkAutoRules();
  await saveBookmarkAutoRules(rules.filter((r) => r.id !== id));
}

/** 更新一条规则 */
export async function updateBookmarkAutoRule(
  id: string,
  patch: Partial<Omit<BookmarkAutoRule, "id" | "createdAt">>,
): Promise<void> {
  const rules = await getBookmarkAutoRules();
  const idx = rules.findIndex((r) => r.id === id);
  if (idx === -1) return;
  const existing = rules[idx];
  if (existing === undefined) return;
  rules[idx] = { ...existing, ...patch };
  await saveBookmarkAutoRules(rules);
}

/**
 * 对单个书签 URL 执行规则匹配，返回第一个匹配的规则。
 * 使用 URLPattern API（Chrome 95+）。
 */
export function matchBookmarkRule(
  url: string,
  rules: BookmarkAutoRule[],
): BookmarkAutoRule | undefined {
  for (const rule of rules) {
    if (!rule.enabled) continue;
    try {
      const pattern = new URLPattern(rule.pattern);
      if (pattern.test(url)) return rule;
    } catch {
      // 无效 pattern 跳过
    }
  }
  return undefined;
}

/**
 * 对书签树中所有书签执行规则匹配，将匹配的书签移动到目标文件夹。
 * 返回移动成功的条数。
 */
export async function applyAutoRulesToAll(): Promise<number> {
  const rules = await getBookmarkAutoRules();
  const enabledRules = rules.filter((r) => r.enabled);
  if (enabledRules.length === 0) return 0;

  const tree = await getBookmarkTree();
  const allBookmarks = flattenBookmarkNodes(tree);
  let moved = 0;

  for (const bm of allBookmarks) {
    if (!bm.url) continue;
    const rule = matchBookmarkRule(bm.url, enabledRules);
    if (!rule) continue;
    // 已在目标文件夹则跳过
    if (bm.parentId === rule.targetFolderId) continue;
    const ok = await moveBookmark(bm.id, rule.targetFolderId);
    if (ok) moved++;
  }

  return moved;
}

/** 确保目标文件夹存在，不存在则在"其他书签"下创建 */
export async function ensureTargetFolder(folderName: string): Promise<string | null> {
  const tree = await getBookmarkTree();
  // 在整棵树中查找同名文件夹
  const found = findFolderByName(tree, folderName);
  if (found) return found.id;
  // 不存在则在"其他书签"(id=2)下创建
  const newFolder = await createBookmark({ parentId: "2", title: folderName });
  return newFolder?.id ?? null;
}

function flattenBookmarkNodes(nodes: BookmarkNode[]): BookmarkNode[] {
  const result: BookmarkNode[] = [];
  for (const node of nodes) {
    if (node.url) result.push(node);
    if (node.children) result.push(...flattenBookmarkNodes(node.children));
  }
  return result;
}

function findFolderByName(nodes: BookmarkNode[], name: string): BookmarkNode | undefined {
  for (const node of nodes) {
    if (!node.url && node.title === name) return node;
    if (node.children) {
      const found = findFolderByName(node.children, name);
      if (found) return found;
    }
  }
  return undefined;
}
