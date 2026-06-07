/**
 * AppHeader — 极简顶栏
 *
 * 布局：左侧品牌+状态 | 中搜索 | 右主题+设置
 */

import { useCallback } from "react";
import { Layout, Space, Button, Tooltip, Tag, Flex } from "antd";
import { Search, Settings, Sun, Moon, SunMoon } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useSettingsStore } from "@/store";
import { useT } from "@/shared/i18n";
import { BRAND } from "@/shared/config/brand";

const { Header } = Layout;

export function AppHeader({
  tabCount,
  domainCount,
  duplicateTabsCount,
  idleTabsCount,
  hasTidySuggestions,
  showBreatheDot,
  compactSearchVisible,
  onSettings,
  onOpenSearch,
  onTidy,
}: {
  tabCount: number;
  domainCount: number;
  duplicateTabsCount: number;
  idleTabsCount: number;
  hasTidySuggestions: boolean;
  showBreatheDot: boolean;
  compactSearchVisible: boolean;
  onSettings: () => void;
  onOpenSearch: () => void;
  onTidy?: () => void;
}) {
  const theme = useSettingsStore((s) => s.settings.theme);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const { t } = useT();

  const toggleTheme = useCallback(() => {
    const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    void updateSettings({ theme: next });
  }, [theme, updateSettings]);

  const themeIcon =
    theme === "system" ? (
      <SunMoon key="sys" size={ICON_SIZE.SMALL} />
    ) : theme === "dark" ? (
      <Moon key="dark" size={ICON_SIZE.SMALL} />
    ) : (
      <Sun key="light" size={ICON_SIZE.SMALL} />
    );

  return (
    <Header className={`app-header-shell${compactSearchVisible ? " is-scrolled" : ""}`}>
      {/* ZONE 1: 身份区 */}
      <Flex align="center" className="app-header-left">
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
              <span className={`app-header-metric-warning${hasTidySuggestions ? " is-warning" : ""}`}>
                {duplicateTabsCount + idleTabsCount}
              </span>{" "}
              {t("待处理")}
              {onTidy && (
                <Button type="link" size="small" className="app-header-tidy-link" onClick={onTidy}>
                  {showBreatheDot && <span className="app-header-breathe-dot" />}
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
          <Search size={ICON_SIZE.DEFAULT} className="app-header-search-icon" />
          <span className="app-header-search-trigger-text">{t("搜索标签页...")}</span>
          <span className="app-kbd" aria-hidden>⌘K</span>
        </Button>
      </Flex>

      {/* ZONE 3: 主题 + 设置 */}
      <Flex align="center" className="app-header-right">
        <Space size={4}>
          <Tooltip title={t(`theme.${theme}`)}>
            <Button size="small" type="text" icon={themeIcon} onClick={toggleTheme} aria-label={t(`theme.${theme}`)} />
          </Tooltip>
          <Tooltip title={t("设置")}>
            <Button size="small" type="text" icon={<Settings size={ICON_SIZE.SMALL} />} onClick={onSettings} aria-label={t("设置")} />
          </Tooltip>
        </Space>
      </Flex>
    </Header>
  );
}
