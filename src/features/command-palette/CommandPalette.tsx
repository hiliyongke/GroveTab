/**
 * CommandPalette —— 全局命令面板（⌘K / Ctrl+K 触发）
 *
 * UX-P0-04 + UX-P0-12：双模式搜索
 *   - 命令模式（默认）：搜索已注册命令，执行动作
 *   - 全局搜索模式（Tab 切换）：搜索所有标签页，点击跳转
 *
 * 功能：
 *   - 模糊 + 拼音搜索
 *   - 键盘导航（上下选择 + Enter 执行 + ESC 关闭）
 *   - Tab 键切换模式
 *   - 分类分组显示
 *   - 快捷键提示
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Modal, Typography, Tag, Divider, Flex, Input, Button } from "antd";
import type { InputRef } from "antd";
import { Search, LayoutGrid, Settings, Monitor, X, Globe, Zap } from "lucide-react";
import { useCommandSearch, type SearchResult } from "./use-command-search";
import type { CommandDef, CommandCategory } from "./command-registry";
import { usePanelStackStore } from "@/shared/panels/panel-stack-store";
import { useTabsStore } from "@/store";
import { useT } from "@/shared/i18n";
import styles from "./CommandPalette.module.less";

const { Text } = Typography;

/** 面板模式 */
type PaletteMode = "command" | "search";

/** 搜索结果中的标签项 */
interface TabSearchResult {
  id: string;
  title: string;
  url: string;
  favIconUrl?: string;
  hostname: string;
  /** 标签页数字 ID（用于 chrome.tabs.update） */
  tabId: number;
}

/** 分类图标映射 */
const CATEGORY_ICON: Record<CommandCategory, React.ReactNode> = {
  navigation: <LayoutGrid size={14} />,
  panel: <Settings size={14} />,
  tab: <X size={14} />,
  settings: <Settings size={14} />,
  workspace: <Monitor size={14} />,
  other: <Search size={14} />,
};

/** 分类标签 */
const CATEGORY_LABEL: Record<CommandCategory, string> = {
  navigation: "导航",
  panel: "面板",
  tab: "标签",
  settings: "设置",
  workspace: "工作区",
  other: "其他",
};

export function CommandPalette() {
  const isOpen = usePanelStackStore((s) => s.isOpen("commandPalette"));
  const { query, setQuery, results, clearQuery } = useCommandSearch();
  const [mode, setMode] = useState<PaletteMode>("command");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<InputRef>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { t } = useT();

  // ── 全局搜索：搜索所有标签页 ──────────────────────────────────────────────
  const tabs = useTabsStore((s) => s.tabs);
  const tabResults: TabSearchResult[] = (() => {
    if (mode !== "search" || !query.trim()) return [];
    const q = query.toLowerCase();
    return tabs
      .filter(
        (tab) =>
          tab.title?.toLowerCase().includes(q) ||
          tab.url?.toLowerCase().includes(q) ||
          tab.hostname?.toLowerCase().includes(q),
      )
      .slice(0, 20)
      .map((tab) => ({
        id: String(tab.id),
        tabId: tab.id,
        title: tab.title ?? "",
        url: tab.url ?? "",
        favIconUrl: tab.favIconUrl,
        hostname: tab.hostname ?? "",
      }));
  })();

  // 打开时自动聚焦搜索框 + 重置模式
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
      clearQuery();
      setMode("command");
    }
  }, [isOpen, clearQuery]);

  // 搜索变更时重置选中
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, mode]);

  // 执行命令
  const executeCommand = useCallback(
    (cmd: CommandDef) => {
      cmd.execute();
      usePanelStackStore.getState().close("commandPalette");
      clearQuery();
    },
    [clearQuery],
  );

  // 打开标签页
  const openTab = useCallback(
    (tabResult: TabSearchResult) => {
      void chrome.tabs.update(tabResult.tabId, { active: true });
      usePanelStackStore.getState().close("commandPalette");
      clearQuery();
    },
    [clearQuery],
  );

  // 键盘导航
  const maxIndex = mode === "command" ? results.length - 1 : tabResults.length - 1;
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Tab") {
        // Tab 键切换模式
        e.preventDefault();
        setMode((m) => (m === "command" ? "search" : "command"));
        setSelectedIndex(0);
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, maxIndex));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (mode === "command" && results[selectedIndex]) {
          executeCommand(results[selectedIndex].item);
        } else if (mode === "search" && tabResults[selectedIndex]) {
          openTab(tabResults[selectedIndex]);
        }
      }
    },
    [results, selectedIndex, executeCommand, mode, tabResults, openTab, maxIndex],
  );

  // 滚动到选中项
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // 按 category 分组（仅命令模式）
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, result) => {
    const cat = result.item.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(result);
    return acc;
  }, {});

  const categoryOrder: CommandCategory[] = [
    "navigation",
    "panel",
    "tab",
    "settings",
    "workspace",
    "other",
  ];

  const placeholder =
    mode === "command" ? t("输入命令或搜索...") : t("搜索标签页（标题/URL/域名）...");

  return (
    <Modal
      open={isOpen}
      onCancel={() => usePanelStackStore.getState().close("commandPalette")}
      footer={null}
      closable={false}
      width={520}
      className={styles["command-palette"]}
      classNames={{
        body: styles["command-palette__body"],
        mask: styles["command-palette__mask"],
      }}
    >
      {/* 搜索输入 */}
      <div className={styles["command-palette__search"]}>
        {mode === "command" ? (
          <Zap size={16} className={styles["command-palette__search-icon"]} />
        ) : (
          <Search size={16} className={styles["command-palette__search-icon"]} />
        )}
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          variant="borderless"
          className={styles["command-palette__input"]}
        />
        {/* 模式指示器 */}
        <Tag
          color={mode === "command" ? "blue" : "green"}
          className={styles["command-palette__mode-tag"]}
          onClick={() => setMode((m) => (m === "command" ? "search" : "command"))}
        >
          {mode === "command" ? t("命令") : t("搜索")}
        </Tag>
        {query && (
          <Button
            type="text"
            size="small"
            className={styles["command-palette__clear"]}
            onClick={clearQuery}
            icon={<X size={14} />}
            aria-label={t("清除")}
          />
        )}
      </div>

      <Divider className={styles["command-palette__divider"]} />

      {/* 结果列表 */}
      <div className={styles["command-palette__list"]} ref={listRef}>
        {mode === "command" ? (
          // ── 命令模式 ──
          <>
            {categoryOrder.map((cat) => {
              const items = grouped[cat];
              if (!items?.length) return null;
              return (
                <div key={cat}>
                  <div className={styles["command-palette__category"]}>{CATEGORY_LABEL[cat]}</div>
                  {items.map((result) => {
                    const globalIndex = results.indexOf(result);
                    return (
                      <div
                        key={result.item.id}
                        className={`${styles["command-palette__item"]} ${
                          globalIndex === selectedIndex
                            ? styles["command-palette__item--selected"]
                            : ""
                        }`}
                        onClick={() => executeCommand(result.item)}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                      >
                        <span className={styles["command-palette__item-icon"]}>
                          {CATEGORY_ICON[result.item.category]}
                        </span>
                        <span className={styles["command-palette__item-label"]}>
                          {result.item.label}
                        </span>
                        {result.item.shortcut && (
                          <Tag className={styles["command-palette__item-shortcut"]}>
                            {result.item.shortcut}
                          </Tag>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {results.length === 0 && (
              <div className={styles["command-palette__empty"]}>
                <Text type="secondary">{t("没有匹配的命令")}</Text>
              </div>
            )}
          </>
        ) : (
          // ── 全局搜索模式 ──
          <>
            {tabResults.map((tab, idx) => (
              <div
                key={tab.id}
                className={`${styles["command-palette__item"]} ${
                  idx === selectedIndex ? styles["command-palette__item--selected"] : ""
                }`}
                onClick={() => openTab(tab)}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <span className={styles["command-palette__item-icon"]}>
                  {tab.favIconUrl ? (
                    <img
                      src={tab.favIconUrl}
                      alt=""
                      width={14}
                      height={14}
                      className={styles["command-palette__favicon"]}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <Globe size={14} />
                  )}
                </span>
                <Flex vertical className={styles["command-palette__tab-text"]}>
                  <Text
                    ellipsis
                    className={styles["command-palette__tab-title"]}
                  >
                    {tab.title || tab.hostname}
                  </Text>
                  <Text
                    type="secondary"
                    ellipsis
                    className={styles["command-palette__tab-url"]}
                  >
                    {tab.url}
                  </Text>
                </Flex>
              </div>
            ))}
            {query && tabResults.length === 0 && (
              <div className={styles["command-palette__empty"]}>
                <Text type="secondary">{t("没有匹配的标签页")}</Text>
              </div>
            )}
            {!query && (
              <div className={styles["command-palette__empty"]}>
                <Text type="secondary">{t("输入关键词搜索所有标签页")}</Text>
              </div>
            )}
          </>
        )}
      </div>

      {/* 底部提示 */}
      <div className={styles["command-palette__footer"]}>
        <Text
          type="secondary"
          className={styles["command-palette__footer-hint"]}
        >
          <kbd>⌘P</kbd> 打开 · <kbd>↑↓</kbd> 导航 · <kbd>Enter</kbd> 执行 · <kbd>Tab</kbd>{" "}
          {mode === "command" ? t("搜索标签") : t("切回命令")} · <kbd>ESC</kbd> 关闭
        </Text>
      </div>
    </Modal>
  );
}
