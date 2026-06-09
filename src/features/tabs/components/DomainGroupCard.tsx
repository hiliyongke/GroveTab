/**
 * DomainGroupCard — 域名分组卡片（antd 版）
 *
 * 设计：
 *   - antd Card 默认视觉；身份色条位置由设置项 `domainGroupAccentBarPosition` 决定：
 *     - `left`（默认）：左侧 2px 竖条，hover 用 transform 做视觉加粗，贴整卡左边缘
 *     - `top`：顶部 2px 横条，hover 用 transform 做视觉加粗，贴卡片顶部
 *     - `none`：完全隐藏身份色条
 *   - 2026-04-22 从 4px 收窄到 2px：原宽度视觉"喧宾夺主"，多卡并排时色条反而
 *     分散了对 favicon 和标题的注意力。2px 细线保留"身份索引"的语义，又不抢戏。
 *   - 两种位置宽度统一，保证视觉语言一致
 *   - 色条采用纯实色（非渐变）；依 `useResolvedTheme()` 挑 barLight / barDark，
 *     浅/深色主题各自克制且可辨
 *   - favicon 外包一层 `accent.soft` 的柔光底板，让"色彩=身份"的语义集中在图标周围
 *   - hover 时整卡 boxShadow 提升 + 色条用合成层 transform 视觉加粗，避免尺寸变化造成抖动
 *   - 子项 favicon 显示可通过设置 `domainGroupShowItemFavicon` 切换
 */

import { useCallback, useMemo, useState, memo } from "react";
import { Tag, Button, Tooltip, Typography, Flex } from "antd";
import { X, Globe, Moon } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import type { DomainGroup } from "@/shared/utils/domain";
import { useAccent } from "@/shared/hooks/use-accent";
import { getFaviconUrl } from "@/features/quick-start/utils/siteUtils";
import type { SpeedDialSite } from "@/shared/types";
import { useResolvedTheme } from "@/shared/hooks/use-resolved-theme";
import { findAmbiguousTitleIds } from "@/shared/utils/url-display";
import { TabItem } from "./TabItem";
import { GroupCardShell } from "./GroupCardShell";
import { useGroupCardSettings } from "../hooks/useCardStyle";
import { useSettingsStore, useTabsStore } from "@/store";
import { useT } from "@/shared/i18n";
import styles from "../styles/items.module.less";

interface DomainGroupCardProps {
  group: DomainGroup;
}

/**
 * 域名分组卡片：头部 + 标签列表（始终展开）
 */
export const DomainGroupCard = memo(function DomainGroupCard({
  group,
}: DomainGroupCardProps) {
  const [faviconError, setFaviconError] = useState(false);
  /** 关闭整个分组的 in-flight 标记，防止重复点击 + 驱动 Button loading */
  const [closing, setClosing] = useState(false);
  const jumpToTab = useTabsStore((s) => s.jumpToTab);
  const closeSingleTab = useTabsStore((s) => s.closeSingleTab);
  const closeDomainGroup = useTabsStore((s) => s.closeDomainGroup);
  const discardDomainGroup = useTabsStore((s) => s.discardDomainGroup);
  /** 用户是否开启「子项显示域名图标」——domain 分组视图的专属 UI 偏好 */
  const showItemFavicon = useSettingsStore((s) => s.settings.domainGroupShowItemFavicon ?? true);
  const { barPosition, cardRadius, token } = useGroupCardSettings();
  const { t } = useT();
  const resolvedTheme = useResolvedTheme();

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


  return (
    <GroupCardShell
      accentBarPosition={barPosition}
      interactive={false}
      barColor={barColor}
      badgeBg={accent.soft}
      cardRadius={cardRadius}
      extraStyle={{
        "--app-hover-border": token.colorBorder,
        "--app-row-hover-bg": token.colorFillSecondary,
      } as React.CSSProperties}
      header={
        <>
          {/*
            分组头部 —— 纯展示，不再可折叠。
            域名徽章 + 域名文本 + 标签计数。
          */}
          <div className={styles["app-domain-group-header"]}>
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
                  width={20}
                  height={20}
                  className={styles["app-domain-group-badge-favicon"]}
                  onError={() => setFaviconError(true)}
                />
              ) : (
                <Globe size={ICON_SIZE.SMALL} className={styles["app-domain-group-badge-icon"]} />
              )}
            </div>
            <Typography.Text className={styles["app-domain-group-title"]}>
              {group.domain}
            </Typography.Text>

            <Tag className={styles["app-domain-group-count"]}>{group.tabs.length}</Tag>
          </div>

          {/* 操作按钮组：flex 排列，不再绝对定位 */}
          <Flex className={styles["app-domain-group-actions"]}>
            {/* 休眠整组——释放内存但保留标签页位置 */}
            <Tooltip title={t("休眠整组")}>
              <Button
                type="text"
                icon={<Moon size={ICON_SIZE.SMALL} />}
                onClick={(e) => {
                  e.stopPropagation();
                  void discardDomainGroup(group.domain).catch(() => {
                    /* store 已 toast */
                  });
                }}
                aria-label={t("休眠整组")}
                className={styles["app-domain-group-action"]}
              />
            </Tooltip>

            {/* 关闭整个域名 */}
            <Tooltip title={t("关闭此域名所有标签页")}>
              <Button
                type="text"
                danger
                loading={closing}
                disabled={closing}
                icon={closing ? undefined : <X size={ICON_SIZE.SMALL} />}
                onClick={(e: React.MouseEvent) => {
                  void handleCloseAll(e);
                }}
                aria-label={t("关闭此域名所有标签页")}
                className={styles["app-domain-group-action"]}
              />
            </Tooltip>
          </Flex>
        </>
      }
    >
      {/* 标签列表 */}
      <Flex vertical gap={4} className={styles["app-domain-group-list--flex"]}>
        {group.tabs.map((tab) => (
          <TabItem
            key={tab.id}
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
            visibleTabIds={group.tabs.map((t) => t.id)}
          />
        ))}
      </Flex>
    </GroupCardShell>
  );
});
