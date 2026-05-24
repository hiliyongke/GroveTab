/**
 * DomainGroupCard — 域名分组卡片（antd 版）
 *
 * 设计：
 *   - antd Card 默认视觉；身份色条位置由设置项 `domainGroupAccentBarPosition` 决定：
 *     - `left`（默认）：左侧 2px 竖条（hover 3px），贴整卡左边缘
 *     - `top`：顶部 2px 横条（hover 3px），贴卡片顶部
 *     - `none`：完全隐藏身份色条
 *   - 2026-04-22 从 4px 收窄到 2px：原宽度视觉"喧宾夺主"，多卡并排时色条反而
 *     分散了对 favicon 和标题的注意力。2px 细线保留"身份索引"的语义，又不抢戏。
 *   - 两种位置宽度统一，保证视觉语言一致
 *   - 色条采用纯实色（非渐变）；依 `useResolvedTheme()` 挑 barLight / barDark，
 *     浅/深色主题各自克制且可辨
 *   - favicon 外包一层 `accent.soft` 的柔光底板，让"色彩=身份"的语义集中在图标周围
 *   - hover 时整卡 boxShadow 提升 + 色条微加粗，不做额外色彩特效
 *   - 子项 favicon 显示可通过设置 `domainGroupShowItemFavicon` 切换
 */

import { useCallback, useMemo, useState } from "react";
import { Tag, Button, Tooltip, theme } from "antd";
import { ChevronDown, X, Globe, Moon } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { Reorder } from "motion/react";
import type { DomainGroup } from "@/shared/utils/domain";
import { useAccent } from "@/shared/hooks/useAccent";
import { getFaviconUrl } from "@/features/quick-start/utils/siteUtils";
import type { SpeedDialSite } from "@/shared/types";
import { useResolvedTheme } from "@/shared/hooks/use-resolved-theme";
import { findAmbiguousTitleIds } from "@/shared/utils/url-display";
import { cssVars } from "@/shared/utils/css-vars";
import { TabItem } from "./TabItem";
import { GroupCardShell } from "./components/GroupCardShell";
import { useCardCollapse } from "./hooks/useCardCollapse";
import { useCardReorder } from "./hooks/useCardReorder";
import { useTabsStore, useSettingsStore } from "@/store";
import { useT } from "@/shared/i18n";
import styles from "./styles/items.module.less";

interface DomainGroupCardProps {
  group: DomainGroup;
  initialCollapsed?: boolean;
}

/**
 * 域名分组卡片：头部（可折叠）+ 标签列表
 */
export function DomainGroupCard({ group, initialCollapsed = false }: DomainGroupCardProps) {
  const { collapsed, toggleCollapse } = useCardCollapse({ initialCollapsed });
  const [faviconError, setFaviconError] = useState(false);
  /** 关闭整个分组的 in-flight 标记，防止重复点击 + 驱动 Button loading */
  const [closing, setClosing] = useState(false);
  const { orderedItems: tabOrder, handleReorder } = useCardReorder(group.tabs);
  const jumpToTab = useTabsStore((s) => s.jumpToTab);
  const closeSingleTab = useTabsStore((s) => s.closeSingleTab);
  const closeDomainGroup = useTabsStore((s) => s.closeDomainGroup);
  const discardDomainGroup = useTabsStore((s) => s.discardDomainGroup);
  /** 用户是否开启「子项显示域名图标」——domain 分组视图的专属 UI 偏好 */
  const showItemFavicon = useSettingsStore((s) => s.settings.domainGroupShowItemFavicon ?? true);
  /** 身份色条位置偏好（left/top/none），默认 left */
  const barPosition = useSettingsStore((s) => s.settings.domainGroupAccentBarPosition ?? "left");
  /** 卡片圆角档位偏好（none/small/default/large），默认 default */
  const radiusPreset = useSettingsStore((s) => s.settings.domainGroupCardRadius ?? "default");
  const { t } = useT();
  const { token } = theme.useToken();
  const resolvedTheme = useResolvedTheme();

  /**
   * 圆角档位 → 实际像素值：
   *   - none：直角（0），硬朗风格
   *   - small：4px，轻微柔化
   *   - default：沿用 antd `borderRadiusLG`（通常 8px），与全站一致
   *   - large：16px，更柔和
   * 同时驱动 Card 本身及色条同侧圆角，保证视觉统一。
   */
  const cardRadius = useMemo(() => {
    switch (radiusPreset) {
      case "none":
        return 0;
      case "small":
        return 4;
      case "large":
        return 16;
      case "default":
      default:
        return token.borderRadiusLG;
    }
  }, [radiusPreset, token.borderRadiusLG]);

  /**
   * 关闭整组处理：
   *   - 立刻翻 closing 禁用按钮
   *   - 把反馈（成功 / 失败 toast）交给 store 层统一处理，这里只做 UI 状态
   */
  const handleCloseAll = useCallback(
    async (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      if (closing) return;
      setClosing(true);
      try {
        await closeDomainGroup(group.domain);
      } catch {
        // store 已弹错误 toast，这里吞掉避免未处理 rejection
      } finally {
        setClosing(false);
      }
    },
    [closeDomainGroup, closing, group.domain],
  );

  /**
   * 构造与 SiteCard 完全一致的 favicon URL
   * 复用 getFaviconUrl() 逻辑：优先用 tab 自带的 favIconUrl，否则公网域名走 Google favicon 代理
   */
  const faviconUrl = useMemo(() => {
    const firstTab = group.tabs[0];
    if (!firstTab) return undefined;
    // 构造与 SiteCard 完全一致的 mock SiteCard
    const mockSite: Partial<SpeedDialSite> = {
      url: firstTab.url?.startsWith("http") ? firstTab.url : `https://${group.domain}`,
      favIconUrl: firstTab.favIconUrl,
    };
    return getFaviconUrl(mockSite as SpeedDialSite);
  }, [group.tabs, group.domain]);

  const localAccent = useAccent(faviconUrl, group.colorKey);
  /** 与常用站点算法一致：从 favicon 提主色，失败回退到 colorKey 哈希色 */
  const accent = localAccent;
  /**
   * 依主题选择身份色变体（2026-04-22 多巴胺版）：
   *   - 浅色主题 → barLight（高饱和 ~0.85、中偏高亮 ~0.58），白底细条上鲜明
   *   - 深色主题 → barDark（高饱和 ~0.80、中高亮 ~0.66），暗底上闪亮可辨
   * 旧 accent 可能没有新字段（缓存过的）—— 兜底到 `accent.bar`
   */
  const barColor = (resolvedTheme === "dark" ? accent.barDark : accent.barLight) ?? accent.bar;

  /** 同组内 title 重复的 tab id 集合 —— 驱动 URL 消歧行的显示 */
  const ambiguousIds = useMemo(() => findAmbiguousTitleIds(group.tabs), [group.tabs]);

  const cardStyle = useMemo<React.CSSProperties>(
    () => ({
      borderRadius: cardRadius || 12,
      overflow: "hidden",
      position: "relative",
      boxShadow: "var(--app-shadow-card)",
      border: `1px solid ${token.colorBorderSecondary}`,
      ...cssVars({
        "--app-hover-border": token.colorBorder,
        "--app-domain-card-radius": `${cardRadius || 12}px`,
        "--app-domain-card-bar": barColor,
        "--app-domain-card-badge-bg": accent.soft,
        "--app-domain-card-header-border": collapsed ? "transparent" : token.colorBorderSecondary,
        "--app-domain-card-chevron-color": token.colorTextTertiary,
        "--app-domain-card-title-color": token.colorText,
        "--app-row-hover-bg": token.colorFillSecondary,
      }),
    }),
    [
      accent.soft,
      barColor,
      cardRadius,
      collapsed,
      token.colorBorder,
      token.colorBorderSecondary,
      token.colorFillSecondary,
      token.colorText,
      token.colorTextTertiary,
    ],
  );

  return (
    <GroupCardShell
      style={cardStyle}
      accentBarPosition={barPosition}
      collapsed={collapsed}
      header={
        <>
          {/* 分组头部 —— 可点击展开/折叠，flex:1 占满剩余空间 */}
          <Button
            type="text"
            onClick={toggleCollapse}
            aria-expanded={!collapsed}
            aria-label={collapsed ? t("tabs.expand") : t("tabs.collapse")}
            className={`app-row-hover ${styles["app-domain-group-header"]}`}
            style={{ flex: 1, minWidth: 0 }}
          >
            <ChevronDown
              size={ICON_SIZE.TINY}
              className={`${styles["app-domain-group-chevron"]}${collapsed ? ` ${styles["is-collapsed"]}` : ""}`}
            />

            {/*
            域名徽章：26×26 圆角方块，底色是 accent.soft（极低透明主色）
            内部要么嵌 favicon，要么在占位图标。把"色彩=身份"的语义集中在这块小徽章里，
            多卡并排时视觉协同——左边条 + 徽章 是同色系，一眼就能把"这是什么网站"传达出去。
          */}
            <div className={styles["app-domain-group-badge"]}>
              {faviconUrl && !faviconError ? (
                <img
                  src={faviconUrl}
                  alt=""
                  className={styles["app-domain-group-badge-favicon"]}
                  onError={() => setFaviconError(true)}
                />
              ) : (
                <Globe size={ICON_SIZE.SMALL} className={styles["app-domain-group-badge-icon"]} />
              )}
            </div>

            <span className={styles["app-domain-group-title"]}>{group.domain}</span>

            <Tag className={styles["app-domain-group-count"]}>{group.tabs.length}</Tag>
          </Button>

          {/* 操作按钮组：flex 排列，不再绝对定位 */}
          <div className={styles["app-domain-group-actions"]}>
            {/* 休眠整组——释放内存但保留标签页位置 */}
            <Tooltip title={t("tabs.discardGroup")}>
              <Button
                type="text"
                size="small"
                icon={<Moon size={ICON_SIZE.SMALL} />}
                onClick={(e) => {
                  e.stopPropagation();
                  void discardDomainGroup(group.domain).catch(() => {
                    /* store 已 toast */
                  });
                }}
                aria-label={t("tabs.discardGroup")}
                className={`app-hover-reveal ${styles["app-domain-group-action"]}`}
              />
            </Tooltip>

            {/* 关闭整个域名 */}
            <Tooltip title={t("tabs.closeDomain")}>
              <Button
                type="text"
                size="small"
                danger
                loading={closing}
                disabled={closing}
                icon={closing ? undefined : <X size={ICON_SIZE.SMALL} />}
                onClick={(e: React.MouseEvent) => {
                  void handleCloseAll(e);
                }}
                aria-label={t("tabs.closeDomain")}
                // closing 时强制显示（is-visible），其余情况由 hover/focus 驱动
                className={`app-hover-reveal ${styles["app-domain-group-action"]}${closing ? ` ${styles["is-visible"]}` : ""}`}
              />
            </Tooltip>
          </div>
        </>
      }
    >
      {/* 标签列表 — 使用 motion Reorder 实现分组内拖拽排序 */}
      <div className={styles["app-domain-group-list"]}>
        <Reorder.Group
          axis="y"
          values={tabOrder}
          onReorder={handleReorder}
          className={styles["app-domain-group-sortable"]}
        >
          {tabOrder.map((tab) => (
            <Reorder.Item
              key={tab.id}
              value={tab}
              className={styles["app-domain-group-sortable-item"]}
              whileDrag={{
                scale: 1.02,
                boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                zIndex: 10,
                position: "relative" as const,
              }}
            >
              <TabItem
                tab={tab}
                onJump={(id, wid) => {
                  void jumpToTab(id, wid);
                }}
                onClose={(id) => {
                  void closeSingleTab(id);
                }}
                hideFavicon={!showItemFavicon}
                showUrlHint={ambiguousIds.has(tab.id)}
                selectable
                visibleTabIds={tabOrder.map((t) => t.id)}
              />
            </Reorder.Item>
          ))}
        </Reorder.Group>
      </div>
    </GroupCardShell>
  );
}
