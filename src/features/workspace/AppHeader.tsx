/**
 * AppHeader v2 —— 4 区收敛结构
 *
 * UX-P0-03 + UX-P0-06 合并实现
 *
 * 区域划分：
 *   1. 身份区（左）：Logo + 状态摘要 + 标签计数
 *   2. 全局搜索（中）：吸附搜索触发器（⌘K / ⌘P）
 *   3. 空间切换（中右）：SpaceSwitcher（3 个空间：workspace / trending / devtools）
 *   4. 工具篮（右）：主题切换 + 溢出菜单（Insights/History/Trash/QuickToggle/Settings）
 *
 * 触发器从 11+ 收敛为 4 区：搜索 / 空间 / 主题 / 溢出菜单
 */

import { useCallback, useState } from "react";
import { Layout, Space, Button, Tooltip, Tag, Flex, Dropdown, Modal } from "antd";
import {
  Search,
  Settings,
  Sun,
  Moon,
  SunMoon,
  BarChart3,
  History,
  Trash2,
  SlidersHorizontal,
  MoreHorizontal,
} from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useSettingsStore } from "@/store";
import { useT } from "@/shared/i18n";
import { BRAND } from "@/shared/config/brand";
import { SpaceSwitcher } from "@/features/workspace/SpaceSwitcher";
import { QuickTogglePanel } from "@/features/workspace/QuickTogglePanel";
import type { SpaceId } from "@/shared/routing";

const { Header } = Layout;

export function AppHeader({
  tabCount,
  domainCount,
  duplicateTabsCount,
  idleTabsCount,
  hasTidySuggestions,
  compactSearchVisible,
  currentSpaceId,
  onSwitchSpace,
  onSettings,
  onOpenSearch,
  onInsights,
  onTidy,
  onOpenHistory,
  onOpenTrash,
}: {
  tabCount: number;
  domainCount: number;
  duplicateTabsCount: number;
  idleTabsCount: number;
  hasTidySuggestions: boolean;
  compactSearchVisible: boolean;
  currentSpaceId: string;
  onSwitchSpace: (spaceId: SpaceId) => void;
  onSettings: () => void;
  onOpenSearch: () => void;
  onInsights?: () => void;
  onTidy?: () => void;
  onOpenHistory?: () => void;
  onOpenTrash?: () => void;
}) {
  const theme = useSettingsStore((s) => s.settings.theme);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const { t } = useT();

  const toggleTheme = useCallback(() => {
    const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    void updateSettings({ theme: next });
  }, [theme, updateSettings]);

  const [quickToggleOpen, setQuickToggleOpen] = useState(false);

  const themeIcon =
    theme === "system" ? (
      <SunMoon key="sys" size={ICON_SIZE.MEDIUM} className="app-icon app-icon--theme" />
    ) : theme === "dark" ? (
      <Moon key="dark" size={ICON_SIZE.MEDIUM} className="app-icon app-icon--theme" />
    ) : (
      <Sun key="light" size={ICON_SIZE.MEDIUM} className="app-icon app-icon--theme" />
    );

  // 溢出菜单项（QuickToggle 也收入此处）
  const overflowItems = [
    {
      key: "insights",
      icon: <BarChart3 size={ICON_SIZE.SMALL} />,
      label: t("本地隐私洞察"),
      onClick: onInsights,
    },
    {
      key: "history",
      icon: <History size={ICON_SIZE.SMALL} />,
      label: t("历史记录"),
      onClick: onOpenHistory,
    },
    {
      key: "trash",
      icon: <Trash2 size={ICON_SIZE.SMALL} />,
      label: t("回收站"),
      onClick: onOpenTrash,
    },
    { type: "divider" as const, key: "divider-tools" },
    {
      key: "quickToggle",
      icon: <SlidersHorizontal size={ICON_SIZE.SMALL} />,
      label: t("quickToggle.title"),
      onClick: () => setQuickToggleOpen(true),
    },
    {
      key: "settings",
      icon: <Settings size={ICON_SIZE.SMALL} />,
      label: t("设置"),
      onClick: onSettings,
    },
  ].filter((item) => {
    if ("onClick" in item) return !!item.onClick;
    return true;
  });

  return (
    <Header className={`app-header-shell${compactSearchVisible ? " is-scrolled" : ""}`}>
      {/* ZONE 1: 身份区 */}
      <Flex align="center" gap={8} className="app-header-left">
        <img src="/icons/logo.png" alt={BRAND.name} className="app-header-logo" />
        <Tag
          color={hasTidySuggestions ? "gold" : "green"}
          className={`app-header-status-tag${compactSearchVisible ? " is-hidden" : ""}`}
        >
          {hasTidySuggestions ? t("可整理") : t("状态良好")}
        </Tag>
        <span className={`app-header-metrics${compactSearchVisible ? " is-hidden" : ""}`}>
          <span className="app-header-metric-strong">{tabCount}</span> {t("标签页")}
          <span className="app-header-dot">·</span>
          <span className="app-header-metric-strong">{domainCount}</span> {t("域名")}
          {(duplicateTabsCount > 0 || idleTabsCount > 0) && (
            <>
              <span className="app-header-dot">·</span>
              <span
                className={`app-header-metric-warning${hasTidySuggestions ? " is-warning" : ""}`}
              >
                {duplicateTabsCount + idleTabsCount}
              </span>{" "}
              {t("待处理")}
              {onTidy && (
                <Button type="link" size="small" className="app-header-tidy-link" onClick={onTidy}>
                  {t("一键整理")}
                </Button>
              )}
            </>
          )}
        </span>
      </Flex>

      {/* ZONE 2: 全局搜索 */}
      <Flex justify="center" className="app-header-center">
        <Button
          type="text"
          onClick={onOpenSearch}
          aria-label={t("搜索标签页...")}
          className={`app-compact-search app-header-search-trigger${compactSearchVisible ? " is-visible" : ""}`}
        >
          <Search
            size={ICON_SIZE.DEFAULT}
            className="app-icon app-icon--search app-header-search-icon"
          />
          <span className="app-header-search-trigger-text">{t("搜索标签页...")}</span>
          <span className="app-kbd" aria-hidden>
            ⌘K
          </span>
        </Button>
      </Flex>

      {/* ZONE 3+4: 空间切换 + 工具篮（合并到右侧列，与左侧等宽占位） */}
      <Flex align="center" gap={8} className="app-header-right">
        <SpaceSwitcher currentSpaceId={currentSpaceId} onSwitchSpace={onSwitchSpace} />
        <Space size={6} className="app-header-actions">
          <Tooltip title={t(`theme.${theme}`)}>
            <Button
              size="small"
              type="text"
              icon={
                <span key={theme} className="app-theme-icon">
                  {themeIcon}
                </span>
              }
              onClick={toggleTheme}
              aria-label={t(`theme.${theme}`)}
            />
          </Tooltip>
          <Dropdown menu={{ items: overflowItems }} trigger={["click"]} placement="bottomRight">
            <Tooltip title={t("更多操作")}>
              <Button
                size="small"
                type="text"
                icon={<MoreHorizontal size={ICON_SIZE.SMALL} className="app-icon" />}
                aria-label={t("更多操作")}
              />
            </Tooltip>
          </Dropdown>
        </Space>
      </Flex>

      {/* QuickToggle 面板 —— P1-5 重构：Popover+隐藏锚点 → Modal
       * 原方案用 position:fixed 隐藏 span 做锚点，布局脆弱。
       * Modal 无锚点依赖，更稳定，且面板内容较多，Modal 的聚焦管理更优。
       */}
      <Modal
        open={quickToggleOpen}
        onCancel={() => setQuickToggleOpen(false)}
        footer={null}
        title={t("quickToggle.title")}
        width={360}
        className="app-quick-toggle-modal"
      >
        <QuickTogglePanel onOpenSettings={onSettings} onClose={() => setQuickToggleOpen(false)} />
      </Modal>
    </Header>
  );
}
