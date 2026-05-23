/**
 * ArcSidebar — Arc 风格侧边栏视图
 *
 * 重构要点：
 *   - 使用 @/chrome 封装层调用 Chrome API，不再直接使用 chrome.*
 *   - 使用 feedback 桥进行错误反馈
 *   - 使用 extractHostname 统一工具函数
 *   - 使用 I18nProvider 支持国际化
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Tooltip, Input, Dropdown } from "antd";
import type { MenuProps } from "antd";
import {
  queryAllTabs,
  activateTab,
  closeTab,
  createTab,
  safeCall,
  getFaviconUrl,
} from "@/chrome/tabs";
import { extractHostname } from "@/chrome/utils";
import { feedback } from "@/shared/ui/feedback";
import { I18nProvider, useT } from "@/shared/i18n";
import { AntdThemeProvider } from "@/shared/ui/AntdThemeProvider";
import "./ArcSidebar.less";

// Types
interface ArcTab {
  id: number;
  windowId: number;
  title: string;
  url: string;
  favIconUrl: string;
  active: boolean;
  pinned: boolean;
  groupId?: number;
}

interface Space {
  id: string;
  name: string;
  icon: string;
  color: string;
  tabs: ArcTab[];
}

// Mock data for Spaces
const defaultSpaces: Space[] = [
  {
    id: "personal",
    name: "Personal",
    icon: "\u{1F3E0}",
    color: "#FF6B35",
    tabs: [],
  },
  {
    id: "work",
    name: "Work",
    icon: "\u{1F4BC}",
    color: "#4ECDC4",
    tabs: [],
  },
  {
    id: "research",
    name: "Research",
    icon: "\u{1F52C}",
    color: "#45B7D1",
    tabs: [],
  },
  {
    id: "entertainment",
    name: "Entertainment",
    icon: "\u{1F3AE}",
    color: "#96CEB4",
    tabs: [],
  },
];

/**
 * 解析 favicon URL：优先使用扩展同源 favicon，兜底原始 favIconUrl
 * @param url - 标签页 URL
 * @param favIconUrl - 原始 favicon URL
 * @returns {string} 返回 favicon URL 字符串
 */
function resolveFaviconUrl(url: string, favIconUrl?: string): string {
  const extensionFavicon = getFaviconUrl(url);
  return extensionFavicon !== "" ? extensionFavicon : (favIconUrl ?? "");
}

/**
 * SpaceButton — 空间按钮组件（memoized style）
 *
 * 将 space button 提取为独立组件，使用 useMemo 缓存 style 对象，
 * 避免在 .map() 回调中每次渲染都创建新的 style 对象。
 */
interface SpaceButtonProps {
  space: Space;
  isActive: boolean;
  onActivate: (spaceId: string) => void;
}

const SpaceButton = React.memo<SpaceButtonProps>(({ space, isActive, onActivate }) => {
  const buttonStyle = useMemo<React.CSSProperties>(
    () =>
      ({
        "--space-color": space.color,
      }) as React.CSSProperties,
    [space.color],
  );

  return (
    <Tooltip title={space.name} placement="right">
      <button
        className={`arc-space-btn ${isActive ? "active" : ""}`}
        style={buttonStyle}
        onClick={() => onActivate(space.id)}
      >
        <span className="arc-space-icon">{space.icon}</span>
        {space.tabs.length > 0 && <span className="arc-space-badge">{space.tabs.length}</span>}
      </button>
    </Tooltip>
  );
});

const ArcSidebarContent: React.FC = () => {
  const [tabs, setTabs] = useState<ArcTab[]>([]);
  const [spaces] = useState<Space[]>(defaultSpaces);
  const [activeSpace, setActiveSpace] = useState<string>("personal");
  const [commandBarVisible, setCommandBarVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchQueryLowerCase = searchQuery.toLowerCase();
  const { t } = useT();

  // Load tabs via @/chrome wrapper
  const loadTabs = useCallback(async () => {
    try {
      const chromeTabs = await queryAllTabs();
      const arcTabs: ArcTab[] = chromeTabs.map((tab) => ({
        id: tab.id!,
        windowId: tab.windowId,
        title: tab.title ?? t("arcSidebar.newTab"),
        url: tab.url ?? "",
        favIconUrl: resolveFaviconUrl(tab.url ?? "", tab.favIconUrl),
        active: tab.active,
        pinned: tab.pinned,
        groupId: tab.groupId,
      }));
      setTabs(arcTabs);
    } catch (error) {
      feedback.error(t("arcSidebar.loadTabsFailed"), error);
    }
  }, [t]);

  useEffect(() => {
    void loadTabs();

    const handleTabChange = () => {
      void loadTabs();
    };

    // 使用 @/chrome 兼容层添加监听
    chrome.tabs.onCreated.addListener(handleTabChange);
    chrome.tabs.onRemoved.addListener(handleTabChange);
    chrome.tabs.onUpdated.addListener(handleTabChange);
    chrome.tabs.onActivated.addListener(handleTabChange);

    return () => {
      chrome.tabs.onCreated.removeListener(handleTabChange);
      chrome.tabs.onRemoved.removeListener(handleTabChange);
      chrome.tabs.onUpdated.removeListener(handleTabChange);
      chrome.tabs.onActivated.removeListener(handleTabChange);
    };
  }, [loadTabs]);

  // Filter tabs based on search
  const filteredTabs = useMemo(
    () =>
      tabs.filter(
        (tab) =>
          tab.title.toLowerCase().includes(searchQueryLowerCase) ||
          tab.url.toLowerCase().includes(searchQueryLowerCase),
      ),
    [tabs, searchQueryLowerCase],
  );

  // Group tabs by domain using extractHostname
  const groupedTabs = useMemo(
    () =>
      filteredTabs.reduce(
        (acc, tab) => {
          const domain = extractHostname(tab.url).replace("www.", "") || "Other";
          acc[domain] ??= [];
          acc[domain].push(tab);
          return acc;
        },
        {} as Record<string, ArcTab[]>,
      ),
    [filteredTabs],
  );

  // Tab click handler — use @/chrome wrapper
  const handleTabClick = useCallback(
    async (tabId: number, windowId: number) => {
      try {
        await activateTab(tabId, windowId);
      } catch (err) {
        feedback.error(t("arcSidebar.activateTabFailed"), err);
      }
    },
    [t],
  );

  // Close tab handler — use @/chrome wrapper
  const handleCloseTab = useCallback(
    async (e: React.MouseEvent, tabId: number) => {
      e.stopPropagation();
      try {
        await closeTab(tabId);
        await loadTabs();
      } catch (err) {
        feedback.error(t("arcSidebar.closeTabFailed"), err);
      }
    },
    [loadTabs, t],
  );

  // New tab handler — use @/chrome wrapper
  const handleNewTab = useCallback(async () => {
    try {
      await createTab({});
      await loadTabs();
    } catch (err) {
      feedback.error(t("arcSidebar.newTabFailed"), err);
    }
  }, [loadTabs, t]);

  // Toggle pin — use safeCall wrapper
  const handleTogglePin = useCallback(
    async (e: React.MouseEvent, tabId: number, pinned: boolean) => {
      e.stopPropagation();
      try {
        await safeCall("tabs.update", () => chrome.tabs.update(tabId, { pinned: !pinned }));
        await loadTabs();
      } catch (err) {
        feedback.error(t("arcSidebar.togglePinFailed"), err);
      }
    },
    [loadTabs, t],
  );

  const handleNewTabClick = useCallback(() => {
    void handleNewTab();
  }, [handleNewTab]);

  const handleCloseCurrentTab = useCallback(() => {
    void (async () => {
      try {
        const tabs = await queryAllTabs();
        const activeTab = tabs.find((tab) => tab.active && tab.id !== undefined);
        if (activeTab?.id !== undefined) {
          await closeTab(activeTab.id);
        }
      } catch (err) {
        feedback.error(t("arcSidebar.closeTabFailed"), err);
      }
    })();
  }, [t]);

  const handleOpenNewWindow = useCallback(() => {
    void safeCall("windows.create", () => chrome.windows.create());
  }, []);

  const handleOpenOptions = useCallback(() => {
    void safeCall("runtime.openOptionsPage", () => chrome.runtime.openOptionsPage());
  }, []);

  // Memoized icon styles to avoid recreating objects on each render
  const smallIconStyle = useMemo<React.CSSProperties>(() => ({ fontSize: 14 }), []);
  const menuIconStyle = useMemo<React.CSSProperties>(() => ({ fontSize: 16 }), []);
  const commandBarIconStyle = useMemo<React.CSSProperties>(
    () => ({ fontSize: 18, color: "var(--arc-text-muted)", marginRight: 12 }),
    [],
  );
  const searchIconStyle = useMemo<React.CSSProperties>(
    () => ({
      color: "var(--arc-text-muted)",
      fontSize: 14,
      position: "absolute" as const,
      left: 20,
      zIndex: 1,
    }),
    [],
  );
  const emptyIconStyle = useMemo<React.CSSProperties>(() => ({ fontSize: 48, opacity: 0.3 }), []);

  // Command bar actions - memoized to prevent recreation on each render
  const commandActions = useMemo<MenuProps["items"]>(
    () => [
      {
        key: "new-tab",
        icon: <span style={smallIconStyle}>➕</span>,
        label: t("arcSidebar.newTab"),
        onClick: handleNewTabClick,
      },
      {
        key: "new-window",
        icon: <span style={smallIconStyle}>🗔</span>,
        label: t("arcSidebar.newWindow"),
        onClick: handleOpenNewWindow,
      },
      {
        key: "close-tab",
        icon: <span style={smallIconStyle}>✕</span>,
        label: t("arcSidebar.closeCurrentTab"),
        onClick: handleCloseCurrentTab,
      },
      { type: "divider" as const },
      {
        key: "settings",
        icon: <span style={smallIconStyle}>⚙</span>,
        label: t("arcSidebar.settings"),
        onClick: handleOpenOptions,
      },
    ],
    [
      smallIconStyle,
      t,
      handleNewTabClick,
      handleOpenNewWindow,
      handleCloseCurrentTab,
      handleOpenOptions,
    ],
  );

  return (
    <div className="arc-sidebar">
      {/* Spaces Bar - Left Edge */}
      <div className="arc-spaces-bar">
        <div className="arc-spaces-header">
          <Tooltip title="Arc Menu" placement="right">
            <button className="arc-menu-btn" aria-label={t("arcSidebar.menu")}>
              <span style={menuIconStyle} aria-hidden="true">
                ⌘
              </span>
            </button>
          </Tooltip>
        </div>

        <div className="arc-spaces-list">
          {spaces.map((space) => (
            <SpaceButton
              key={space.id}
              space={space}
              isActive={activeSpace === space.id}
              onActivate={setActiveSpace}
            />
          ))}
        </div>

        <div className="arc-spaces-footer">
          <Tooltip title={t("arcSidebar.addSpace")} placement="right">
            <button className="arc-space-btn add-space" aria-label={t("arcSidebar.addSpace")}>
              <span style={smallIconStyle} aria-hidden="true">
                +
              </span>
            </button>
          </Tooltip>
          <Tooltip title={t("arcSidebar.settings")} placement="right">
            <button className="arc-space-btn" aria-label={t("arcSidebar.settings")}>
              <span style={smallIconStyle} aria-hidden="true">
                ⚙
              </span>
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Main Sidebar Content */}
      <div className="arc-sidebar-content">
        {/* Search Bar */}
        <div className="arc-search-bar">
          <span className="arc-search-icon" style={searchIconStyle}>
            🔍
          </span>
          <Input
            placeholder={t("arcSidebar.searchTabs")}
            className="arc-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <kbd className="arc-shortcut">⌘K</kbd>
        </div>

        {/* Pinned Tabs */}
        {filteredTabs.filter((t) => t.pinned).length > 0 && (
          <div className="arc-section">
            <div className="arc-section-title">{t("arcSidebar.pinned")}</div>
            <div className="arc-tabs-list">
              {filteredTabs
                .filter((t) => t.pinned)
                .map((tab) => (
                  <ArcTabItem
                    key={tab.id}
                    tab={tab}
                    onActivate={() => {
                      void handleTabClick(tab.id, tab.windowId);
                    }}
                    onClose={(e) => {
                      void handleCloseTab(e, tab.id);
                    }}
                    onTogglePin={(e) => {
                      void handleTogglePin(e, tab.id, tab.pinned);
                    }}
                    t={t}
                  />
                ))}
            </div>
          </div>
        )}

        {/* Tab Groups by Domain */}
        {Object.entries(groupedTabs).map(([domain, domainTabs]) => (
          <div key={domain} className="arc-section">
            <div className="arc-section-title">
              <img
                src={
                  getFaviconUrl(`https://${domain}`) ||
                  `https://www.google.com/s2/favicons?domain=${domain}`
                }
                alt=""
                className="arc-domain-favicon"
              />
              {domain}
              <span className="arc-tab-count">{domainTabs.filter((t) => !t.pinned).length}</span>
            </div>
            <div className="arc-tabs-list">
              {domainTabs
                .filter((tab) => !tab.pinned)
                .map((tab) => (
                  <ArcTabItem
                    key={tab.id}
                    tab={tab}
                    onActivate={() => {
                      void handleTabClick(tab.id, tab.windowId);
                    }}
                    onClose={(e) => {
                      void handleCloseTab(e, tab.id);
                    }}
                    onTogglePin={(e) => {
                      void handleTogglePin(e, tab.id, tab.pinned);
                    }}
                    t={t}
                  />
                ))}
            </div>
          </div>
        ))}

        {/* Empty State */}
        {filteredTabs.length === 0 && (
          <div className="arc-empty-state">
            <span className="arc-empty-icon" style={emptyIconStyle}>
              🔍
            </span>
            <p>{t("arcSidebar.noTabsFound")}</p>
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="arc-sidebar-footer">
        <button className="arc-footer-btn" onClick={handleNewTabClick}>
          <span style={smallIconStyle}>➕</span>
          <span>{t("arcSidebar.newTab")}</span>
        </button>
        <Dropdown menu={{ items: commandActions }} trigger={["click"]} placement="topRight">
          <button className="arc-footer-btn icon-only" aria-label={t("arcSidebar.moreActions")}>
            <span style={menuIconStyle} aria-hidden="true">
              ⋯
            </span>
          </button>
        </Dropdown>
      </div>

      {/* Command Bar Overlay */}
      {commandBarVisible && (
        <div
          className="arc-command-bar-overlay"
          onClick={() => setCommandBarVisible(false)}
          role="dialog"
          aria-modal="true"
          aria-label={t("arcSidebar.commandBar")}
        >
          <div className="arc-command-bar" onClick={(e) => e.stopPropagation()}>
            <Input
              autoFocus
              placeholder={t("arcSidebar.commandPlaceholder")}
              className="arc-command-input"
              prefix={<span style={commandBarIconStyle}>⌘</span>}
            />
            <div className="arc-command-results">
              <div className="arc-command-item">
                <span>🔍</span>
                <span>{t("arcSidebar.searchTabs")}</span>
              </div>
              <div className="arc-command-item">
                <span>➕</span>
                <span>{t("arcSidebar.newTab")}</span>
                <kbd>⌘T</kbd>
              </div>
              <div className="arc-command-item">
                <span>✕</span>
                <span>{t("arcSidebar.closeCurrentTab")}</span>
                <kbd>⌘W</kbd>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Tab 行组件 — 提取复用，避免 pinned/domain 列表重复渲染逻辑
 * @param root0 - 组件属性
 * @param root0.tab - 标签页对象
 * @param root0.onActivate - 激活回调
 * @param root0.onClose - 关闭回调
 * @param root0.onTogglePin - 切换固定回调
 * @param root0.t - i18n 翻译函数
 * @returns {JSX.Element} 返回标签页行 JSX 元素
 */
function ArcTabItem({
  tab,
  onActivate,
  onClose,
  onTogglePin,
  t,
}: {
  tab: ArcTab;
  onActivate: () => void;
  onClose: (e: React.MouseEvent) => void;
  onTogglePin: (e: React.MouseEvent) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <div
      className={`arc-tab-item ${tab.pinned ? "pinned" : ""} ${tab.active ? "active" : ""}`}
      onClick={onActivate}
    >
      <img
        src={tab.favIconUrl || "chrome://favicon/"}
        alt=""
        className="arc-tab-favicon"
        onError={(e) => {
          (e.target as HTMLImageElement).src =
            'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="%23666"/></svg>';
        }}
      />
      <span className="arc-tab-title">{tab.title}</span>
      <div className="arc-tab-actions">
        <button
          className="arc-tab-action-btn"
          onClick={onTogglePin}
          aria-label={tab.pinned ? t("arcSidebar.unpinTab") : t("arcSidebar.pinTab")}
          aria-pressed={tab.pinned}
        >
          {tab.pinned ? "★" : "☆"}
        </button>
        <button
          className="arc-tab-action-btn close"
          onClick={onClose}
          aria-label={t("arcSidebar.closeTab")}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

const ArcSidebar: React.FC = () => {
  return (
    <AntdThemeProvider>
      <I18nProvider>
        <ArcSidebarContent />
      </I18nProvider>
    </AntdThemeProvider>
  );
};

export default ArcSidebar;
