import { useCallback } from "react";
import { Layout, Space, Button, Tooltip, Tag, Flex } from "antd";
import { Search, Settings, Sun, Moon, SunMoon, Globe, BarChart3, History, Trash2 } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useSettingsStore } from "@/store";
import { useT } from "@/shared/i18n";
import { BRAND } from "@/shared/config/brand";
import { DropdownMenu } from "@/features/workspace/DropdownMenu";
import { WorkspaceSwitcher } from "@/features/workspace/WorkspaceSwitcher";
import type { NewtabPageMode } from "@/shared/types";

const { Header } = Layout;

/**
 * 顶栏：轻量工具条（标签计数 + 吸附搜索 + 操作按钮）
 *
 * 设计策略：
 *   - 不再放品牌 logo（已移到 HeroBar 居中展示），Header 仅作功能栏
 *   - 左侧：小型 logo 图标 + 标签计数，紧凑不抢视觉
 *   - 中部：滚动吸附搜索触发器（Hero 搜索框滚出视野时渐显）
 *   - 右侧：归档 / 明暗切换 / 设置
 *   - 整体更薄更轻，把视觉重心让给 Hero 区的品牌 + 搜索
 */
export function AppHeader({
  tabCount,
  domainCount,
  duplicateTabsCount,
  idleTabsCount,
  hasTidySuggestions,
  compactSearchVisible,
  pageMode,
  onPageModeChange,
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
  pageMode: NewtabPageMode;
  onPageModeChange: (mode: NewtabPageMode) => void;
  onSettings: () => void;
  onOpenSearch: () => void;
  onInsights?: () => void;
  /** 一键整理回调 */
  onTidy?: () => void;
  /** 打开「插件历史记录」面板 */
  onOpenHistory?: () => void;
  /** 打开「回收站」面板 */
  onOpenTrash?: () => void;
}) {
  const theme = useSettingsStore((s) => s.settings.theme);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const { t } = useT();
  /** 循环切换 light → dark → system */
  const toggleTheme = useCallback(() => {
    const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    void updateSettings({ theme: next });
  }, [theme, updateSettings]);

  /**
   * 主题图标：三态分别用差异化强烈的图形，避免「点了看不出变化」
   *   - light  → 太阳 ☀
   *   - dark   → 月亮 🌙
   *   - system → 日月同辉 ☀🌙
   */
  const themeIcon =
    theme === "system" ? (
      <SunMoon key="sys" size={ICON_SIZE.MEDIUM} className="app-icon app-icon--theme" />
    ) : theme === "dark" ? (
      <Moon key="dark" size={ICON_SIZE.MEDIUM} className="app-icon app-icon--theme" />
    ) : (
      <Sun key="light" size={ICON_SIZE.MEDIUM} className="app-icon app-icon--theme" />
    );

  return (
    <Header className={`app-header-shell${compactSearchVisible ? " is-scrolled" : ""}`}>
      {/* 左侧：小 logo + 状态摘要 */}
      <Flex align="center" gap={8} className="app-header-left">
        <img src="/icons/logo.png" alt={BRAND.name} className="app-header-logo" />
        {/* 状态徽标 */}
        <Tag
          color={hasTidySuggestions ? "gold" : "green"}
          className={`app-header-status-tag${compactSearchVisible ? " is-hidden" : ""}`}
        >
          {hasTidySuggestions ? t('可整理') : t('状态良好')}
        </Tag>
        {/* 核心计数 —— 仅在吸附搜索未激活时显示 */}
        <span className={`app-header-metrics${compactSearchVisible ? " is-hidden" : ""}`}>
          <span className="app-header-metric-strong">{tabCount}</span> {t('标签页')}
          <span className="app-header-dot">·</span>
          <span className="app-header-metric-strong">{domainCount}</span>{" "}
          {t('域名')}
          {(duplicateTabsCount > 0 || idleTabsCount > 0) && (
            <>
              <span className="app-header-dot">·</span>
              <span
                className={`app-header-metric-warning${hasTidySuggestions ? " is-warning" : ""}`}
              >
                {duplicateTabsCount + idleTabsCount}
              </span>{" "}
              {t('待处理')}
              {onTidy && (
                <Button type="link" className="app-header-tidy-link" onClick={onTidy}>
                  {t('一键整理')}
                </Button>
              )}
            </>
          )}
        </span>
      </Flex>

      {/*
        中部吸附搜索触发器
        ---------------------------------
        · flex:1 占满中间空间
        · Hero 搜索框在视野内时隐藏，滚出后渐显
      */}
      <Flex flex="1 1 520px" justify="center" className="app-header-center">
        <Button
          type="text"
          onClick={onOpenSearch}
          aria-label={t('搜索标签页...')}
          className={`app-compact-search app-header-search-trigger${compactSearchVisible ? " is-visible" : ""}`}
        >
          <Search
            size={ICON_SIZE.DEFAULT}
            className="app-icon app-icon--search app-header-search-icon"
          />
          <span className="app-header-search-trigger-text">{t('搜索标签页...')}</span>
          <span className="app-kbd" aria-hidden>
            ⌘K
          </span>
        </Button>
      </Flex>

      <Space size={6} className="app-header-actions">
        {pageMode !== "workspace" && (
          <Button
            size="small"
            type="text"
            icon={<Globe size={ICON_SIZE.SMALL} />}
            onClick={() => onPageModeChange("workspace")}
          >
            {t('工作台')}
          </Button>
        )}
        <DropdownMenu currentPageMode={pageMode} onPageModeChange={onPageModeChange} />
        <WorkspaceSwitcher />
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
        <Tooltip title={t('设置')}>
          <Button
            size="small"
            type="text"
            icon={<Settings size={ICON_SIZE.SMALL} className="app-icon app-icon--settings" />}
            onClick={onSettings}
            aria-label={t('设置')}
          />
        </Tooltip>
        {onInsights && (
          <Tooltip title={t('本地隐私洞察')}>
            <Button
              size="small"
              type="text"
              icon={<BarChart3 size={ICON_SIZE.SMALL} className="app-icon app-icon--insights" />}
              onClick={onInsights}
              aria-label={t('本地隐私洞察')}
            />
          </Tooltip>
        )}
        {onOpenHistory && (
          <Tooltip title={t('历史记录')}>
            <Button
              size="small"
              type="text"
              icon={<History size={ICON_SIZE.SMALL} className="app-icon" />}
              onClick={onOpenHistory}
              aria-label={t('历史记录')}
            />
          </Tooltip>
        )}
        {onOpenTrash && (
          <Tooltip title={t('回收站')}>
            <Button
              size="small"
              type="text"
              icon={<Trash2 size={ICON_SIZE.SMALL} className="app-icon" />}
              onClick={onOpenTrash}
              aria-label={t('回收站')}
            />
          </Tooltip>
        )}
      </Space>
    </Header>
  );
}
