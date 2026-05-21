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

import { useState, useCallback, useMemo } from 'react';
import { Card, Tag, Button, Tooltip, theme } from 'antd';
import {
  ChevronDown,
  X,
  Globe,
  Moon,
} from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { Reorder } from 'motion/react';
import type { DomainGroup } from '@/shared/utils/domain';
import { getGroupFavicon } from '@/shared/utils/domain';
import { useAccent } from '@/shared/hooks/useAccent';
import { useResolvedTheme } from '@/shared/hooks/use-resolved-theme';
import { findAmbiguousTitleIds } from '@/shared/utils/url-display';
import type { Accent } from '@/shared/utils/favicon-color';
import { TabItem } from './TabItem';
import { useTabsStore, useSettingsStore } from '@/store';
import { useT } from '@/shared/i18n';
import './styles/items.css';

interface DomainGroupCardProps {
  group: DomainGroup;
  initialCollapsed?: boolean;
  /**
   * 外部注入的强调色——由父层的 `useGroupAccents` 做批次内去重后下发。
   * 未提供时退回到 `useAccent` 单独取色（向后兼容）。
   */
  accentOverride?: Accent;
}

/**
 * 域名分组卡片：头部（可折叠）+ 标签列表
 */
export function DomainGroupCard({ group, initialCollapsed = false, accentOverride }: DomainGroupCardProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [faviconError, setFaviconError] = useState(false);
  /** 关闭整个分组的 in-flight 标记，防止重复点击 + 驱动 Button loading */
  const [closing, setClosing] = useState(false);
  /**
   * 用户手动拖拽后的标签 ID 顺序。
   * null 表示未拖拽过，此时 tabOrder 直接等于 group.tabs。
   * 用 ID 而非完整对象存储，避免 group.tabs 更新（关闭/新增）时产生 stale state。
   */
  const [orderOverride, setOrderOverride] = useState<number[] | null>(null);
  const jumpToTab = useTabsStore((s) => s.jumpToTab);
  const closeSingleTab = useTabsStore((s) => s.closeSingleTab);
  const closeDomainGroup = useTabsStore((s) => s.closeDomainGroup);
  const discardDomainGroup = useTabsStore((s) => s.discardDomainGroup);
  /** 用户是否开启「子项显示域名图标」——domain 分组视图的专属 UI 偏好 */
  const showItemFavicon = useSettingsStore(
    (s) => s.settings.domainGroupShowItemFavicon ?? true,
  );
  /** 身份色条位置偏好（left/top/none），默认 left */
  const barPosition = useSettingsStore(
    (s) => s.settings.domainGroupAccentBarPosition ?? 'left',
  );
  /** 卡片圆角档位偏好（none/small/default/large），默认 default */
  const radiusPreset = useSettingsStore(
    (s) => s.settings.domainGroupCardRadius ?? 'default',
  );
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
      case 'none':
        return 0;
      case 'small':
        return 4;
      case 'large':
        return 16;
      case 'default':
      default:
        return token.borderRadiusLG;
    }
  }, [radiusPreset, token.borderRadiusLG]);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

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

  const favicon = getGroupFavicon(group.tabs);
  /** 优先从 favicon 提主色，失败回退到 colorKey 哈希色；同家族子域自动共享（因 favicon 通常相同） */
  const localAccent = useAccent(favicon, group.colorKey);
  /** 外部传入的 accentOverride 优先——父层已做批次去重，保证相邻卡不会撞色 */
  const accent = accentOverride ?? localAccent;
  /**
   * 依主题选择身份色变体（2026-04-22 多巴胺版）：
   *   - 浅色主题 → barLight（高饱和 ~0.85、中偏高亮 ~0.58），白底细条上鲜明
   *   - 深色主题 → barDark（高饱和 ~0.80、中高亮 ~0.66），暗底上闪亮可辨
   * 旧 accent 可能没有新字段（缓存过的）—— 兜底到 `accent.bar`
   */
  const barColor =
    (resolvedTheme === 'dark' ? accent.barDark : accent.barLight) ?? accent.bar;

  /** 同组内 title 重复的 tab id 集合 —— 驱动 URL 消歧行的显示 */
  const ambiguousIds = useMemo(() => findAmbiguousTitleIds(group.tabs), [group.tabs]);

  /**
   * 派生 tabOrder：优先按 orderOverride 中的 ID 顺序排，
   * 再追加 group.tabs 中未在 orderOverride 里出现的（新增标签）。
   * 已删除的标签 ID 会在 freshMap.get(id) 时自然过滤掉。
   * 此值在渲染期通过 useMemo 计算，不触发 setState，符合 React 19 纪律。
   */
  const tabOrder = useMemo(() => {
    if (!orderOverride) return group.tabs;

    const freshMap = new Map(group.tabs.map((t) => [t.id, t]));
    const result: typeof group.tabs = [];

    for (const id of orderOverride) {
      const tab = freshMap.get(id);
      if (tab) {
        result.push(tab);
        freshMap.delete(id);
      }
    }

    for (const tab of group.tabs) {
      if (freshMap.has(tab.id)) result.push(tab);
    }

    return result;
  }, [group.tabs, orderOverride]);

  /** 拖拽完成时只更新 ID 顺序，不直接操作完整 tab 对象 */
  const handleReorder = useCallback(
    (newOrder: typeof group.tabs) => {
      setOrderOverride(newOrder.map((t) => t.id));
    },
    [],
  );

  const cardStyle = useMemo(
    () =>
      ({
        borderRadius: cardRadius || 12,
        overflow: 'hidden',
        position: 'relative',
        boxShadow: 'var(--app-shadow-card)',
        border: `1px solid ${token.colorBorderSecondary}`,
        ['--app-hover-border' as string]: token.colorBorder,
        ['--app-domain-card-radius' as string]: `${cardRadius || 12}px`,
        ['--app-domain-card-bar' as string]: barColor,
        ['--app-domain-card-badge-bg' as string]: accent.soft,
        ['--app-domain-card-header-border' as string]: collapsed ? 'transparent' : token.colorBorderSecondary,
        ['--app-domain-card-chevron-color' as string]: token.colorTextTertiary,
        ['--app-domain-card-title-color' as string]: token.colorText,
        ['--app-row-hover-bg' as string]: token.colorFillSecondary,
      }) as React.CSSProperties,
    [accent.soft, barColor, cardRadius, collapsed, token.colorBorder, token.colorBorderSecondary, token.colorFillSecondary, token.colorText, token.colorTextTertiary],
  );

  return (
    <Card
      size="small"
      className="app-card-interactive app-hover-reveal-host app-domain-group-card"
      classNames={{ body: 'app-domain-group-card__body' }}
      style={cardStyle}
    >
      {/*
        身份色条 —— 位置依用户偏好渲染：
          - left：贴整卡左边缘的 2px 竖条（hover 3px）
          - top ：贴卡片顶部的 2px 横条（hover 3px）
          - none：不渲染
        色条始终使用依主题挑好的 barLight/barDark 纯实色，无渐变、无霓虹。
        无障碍：aria-hidden，不参与语义。
      */}
      {barPosition === 'left' && (
        <div aria-hidden className="app-accent-bar--left" />
      )}
      {barPosition === 'top' && (
        <div aria-hidden className="app-accent-bar--top" />
      )}
      {/* 分组头部 —— 可点击展开/折叠 */}
      <button
        type="button"
        onClick={toggleCollapse}
        aria-expanded={!collapsed}
        aria-label={collapsed ? t('tabs.expand') : t('tabs.collapse')}
        className="app-row-hover app-domain-group-header"
      >
        <ChevronDown
          size={ICON_SIZE.TINY}
          className={`app-domain-group-chevron${collapsed ? ' is-collapsed' : ''}`}
        />

        {/*
          域名徽章：26×26 圆角方块，底色是 accent.soft（极低透明主色）
          内部要么嵌 favicon，要么在占位图标。把"色彩=身份"的语义集中在这块小徽章里，
          多卡并排时视觉协同——左边条 + 徽章 是同色系，一眼就能把"这是什么网站"传达出去。
        */}
        <div className="app-domain-group-badge">
          {favicon && !faviconError ? (
            <img
              src={favicon}
              alt=""
              className="app-domain-group-badge-favicon"
              onError={() => setFaviconError(true)}
            />
          ) : (
            <Globe size={ICON_SIZE.SMALL} className="app-domain-group-badge-icon" />
          )}
        </div>

        <span className="app-domain-group-title">
          {group.domain}
        </span>

        <Tag className="app-domain-group-count">
          {group.tabs.length}
        </Tag>
      </button>

      {/* 休眠整组——释放内存但保留标签页位置 */}
      <Tooltip title={t('tabs.discardGroup')}>
        <Button
          type="text"
          size="small"
          icon={<Moon size={ICON_SIZE.SMALL} />}
          onClick={(e) => {
            e.stopPropagation();
            void discardDomainGroup(group.domain).catch(() => { /* store 已 toast */ });
          }}
          aria-label={t('tabs.discardGroup')}
          className="app-hover-reveal app-domain-group-action app-domain-group-action--discard"
        />
      </Tooltip>

      {/* 关闭整个域名 —— 独立按钮，绝对定位覆盖在 header 右侧 */}
      <Tooltip title={t('tabs.closeDomain')}>
        <Button
          type="text"
          size="small"
          danger
          loading={closing}
          disabled={closing}
          icon={closing ? undefined : <X size={ICON_SIZE.SMALL} />}
          onClick={(e: React.MouseEvent) => { void handleCloseAll(e); }}
          aria-label={t('tabs.closeDomain')}
          // closing 时强制显示（is-visible），其余情况由 hover/focus 驱动
          className={`app-hover-reveal app-domain-group-action app-domain-group-action--close${closing ? ' is-visible' : ''}`}
        />
      </Tooltip>

      {/* 标签列表 — 使用 motion Reorder 实现分组内拖拽排序 */}
      {!collapsed && (
        <div className="app-domain-group-list">
          <Reorder.Group
            axis="y"
            values={tabOrder}
            onReorder={handleReorder}
            className="app-domain-group-sortable"
          >
            {tabOrder.map((tab) => (
              <Reorder.Item
                key={tab.id}
                value={tab}
                className="app-domain-group-sortable-item"
                whileDrag={{ scale: 1.02, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 10, position: 'relative' as const }}
              >
                <TabItem
                  tab={tab}
                  onJump={(id, wid) => { void jumpToTab(id, wid); }}
                  onClose={(id) => { void closeSingleTab(id); }}
                  hideFavicon={!showItemFavicon}
                  showUrlHint={ambiguousIds.has(tab.id)}
                  selectable
                  visibleTabIds={tabOrder.map((t) => t.id)}
                />
              </Reorder.Item>
            ))}
          </Reorder.Group>
        </div>
      )}
    </Card>
  );
}
