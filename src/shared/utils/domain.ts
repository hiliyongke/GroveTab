/**
 * 域名工具 —— 使用 tldts 解析注册域、子域名
 *
 * 分组策略（多级域名处理的关键）：
 *   - 以 **hostname（完整主机名）** 作为聚合主键
 *     → `docs.google.com` 与 `mail.google.com` 各自独立成卡，
 *       favicon、计数、关闭操作互不混淆
 *   - 另外暴露 **colorKey（注册域）** 给色系使用
 *     → `docs.google.com` / `mail.google.com` 共享同一色系，
 *       视觉上仍能看出"同属 Google 家族"
 *   - IP 与 `localhost` 无注册域，hostname 与 colorKey 相同
 */

import { parse } from 'tldts';

interface DomainInfo {
  /** 完整主机名，如 docs.google.com */
  hostname: string;
  /** 注册域，如 google.com（无法解析时回退到 hostname） */
  registeredDomain: string;
  /** 子域名部分，如 docs */
  subdomain: string | null;
}

/**
 * 解析 URL，拿到 hostname / 注册域 / 子域三元组
 */
function getDomainInfo(url: string): DomainInfo {
  try {
    const parsed = parse(url);
    const hostname = parsed.hostname ?? '';
    const registeredDomain = parsed.domain ?? hostname;
    return {
      hostname,
      registeredDomain,
      subdomain: parsed.subdomain ?? null,
    };
  } catch {
    return {
      hostname: '',
      registeredDomain: '',
      subdomain: null,
    };
  }
}

/**
 * 域名分组对象
 */
export interface DomainGroup {
  /** 分组键（hostname，显示与聚合都用它） */
  domain: string;
  /** 色键（注册域，同家族子域共享同色系） */
  colorKey: string;
  /** 该分组下的标签页 */
  tabs: Array<import('@/shared/types').LiveTab>;
  /** 是否折叠 */
  collapsed: boolean;
}

import type { LiveTab } from '@/shared/types';

/**
 * 按 hostname 聚合标签页
 *
 * 排序：
 *   1. tab 数量多的在前
 *   2. 数量相同时，同一注册域（家族）聚拢在一起
 *   3. 最后按分组内最近活跃时间
 */
export function groupTabsByDomain(tabs: LiveTab[]): DomainGroup[] {
  /** key: hostname，value: { colorKey, tabs } */
  const groupMap = new Map<string, { colorKey: string; tabs: LiveTab[] }>();

  for (const tab of tabs) {
    const info = getDomainInfo(tab.url);
    const domain = info.hostname || info.registeredDomain || 'other';
    const colorKey = info.registeredDomain || domain;
    const entry = groupMap.get(domain);
    if (entry) {
      entry.tabs.push(tab);
    } else {
      groupMap.set(domain, { colorKey, tabs: [tab] });
    }
  }

  const groups: DomainGroup[] = Array.from(groupMap.entries()).map(([domain, { colorKey, tabs: groupTabs }]) => ({
    domain,
    colorKey,
    tabs: groupTabs.sort((a, b) => b.lastAccessed - a.lastAccessed),
    collapsed: false,
  }));

  groups.sort((a, b) => {
    // 1. tab 数量多的在前
    if (b.tabs.length !== a.tabs.length) return b.tabs.length - a.tabs.length;
    // 2. 同一家族（注册域相同）聚拢，方便视觉连贯
    if (a.colorKey !== b.colorKey) return a.colorKey.localeCompare(b.colorKey);
    // 3. 再按最近活跃时间
    const aLatest = a.tabs[0]?.lastAccessed ?? 0;
    const bLatest = b.tabs[0]?.lastAccessed ?? 0;
    return bLatest - aLatest;
  });

  return groups;
}
