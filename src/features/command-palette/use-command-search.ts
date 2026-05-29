/**
 * useCommandSearch —— 基于 fuse.js 的命令搜索 Hook
 *
 * 支持拼音 + 模糊搜索，返回排序后的匹配命令列表。
 */

import { useMemo, useState, useCallback } from "react";
import Fuse, { type FuseResult } from "fuse.js";
import type { CommandDef } from "./command-registry";
import { getAvailableCommands } from "./command-registry";

/** 搜索结果项 */
export interface SearchResult {
  item: CommandDef;
  score?: number;
}

/**
 * useCommandSearch
 */
export function useCommandSearch() {
  const [query, setQuery] = useState("");

  // 获取所有可用命令
  const commands = useMemo(() => getAvailableCommands(), []);

  // Fuse 实例：搜索 label + keywords
  const fuse = useMemo(
    () =>
      new Fuse(commands, {
        keys: [
          { name: "label", weight: 0.7 },
          { name: "keywords", weight: 0.3 },
        ],
        threshold: 0.4,
        includeScore: true,
      }),
    [commands],
  );

  // 搜索结果
  const results: SearchResult[] = useMemo(() => {
    if (!query.trim()) {
      // 无查询时返回所有命令，按 category 分组排序
      return commands
        .sort((a, b) => {
          const order: Record<string, number> = {
            navigation: 0,
            panel: 1,
            tab: 2,
            settings: 3,
            workspace: 4,
            other: 5,
          };
          return (order[a.category] ?? 5) - (order[b.category] ?? 5);
        })
        .map((item) => ({ item }));
    }
    return fuse.search(query).map((r: FuseResult<CommandDef>) => ({ item: r.item, score: r.score }));
  }, [query, fuse, commands]);

  const clearQuery = useCallback(() => setQuery(""), []);

  return {
    query,
    setQuery,
    results,
    clearQuery,
    /** 命令总数 */
    total: commands.length,
  };
}
