/**
 * GridView —— 卡片网格视图（antd 版）
 *
 * 设计：
 *   - 响应式列数（CSS grid auto-fill）
 *   - 缩略图区基于域名色的浅色渐变，提供弱识别
 *   - hover 卡片上浮 2px，边框染品牌色
 *   - 卡片角标显示该域名下的 tab 数
 *
 * 交互：
 *   - **单 tab**：点击直接跳转（快捷路径）
 *   - **多 tab**：点击展开 Popover（锚定到卡片、无遮罩、带 arrow），
 *     展示该域名下的完整列表。
 *     选用 Popover 而非 Modal 的理由：
 *       1. "查看同域名的几个 tab" 属于轻量心流，Modal 的遮罩过重
 *       2. Popover 的 arrow 直接把浮层和触发卡片视觉绑定，锚点清晰
 *       3. 支持 Esc 关闭 + outside-click 关闭，与 antd 原生一致
 *       4. 不打断 Grid 的浏览上下文
 */

import { useMemo, useState } from 'react';
import { Button, Card, Popover, theme } from 'antd';
import { Volume2, X } from 'lucide-react';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { useTabsStore } from '@/store';
import { useT } from '@/shared/i18n';
import { groupTabsByDomain } from '@/shared/utils/domain';
import { useAccent } from '@/shared/hooks/useAccent';
import { findAmbiguousTitleIds } from '@/shared/utils/url-display';
import { cssVars } from '@/shared/utils/css-vars';
import { TabItem } from './TabItem';
import type { LiveTab } from '@/shared/types';
import './styles/views.css';

/**
 * 网格视图主组件：每个域名一张大卡片
 */
export function GridView() {
  const tabs = useTabsStore((s) => s.tabs);
  const jumpToTab = useTabsStore((s) => s.jumpToTab);
  const closeSingleTab = useTabsStore((s) => s.closeSingleTab);
  const { t } = useT();

  const groups = useMemo(() => groupTabsByDomain(tabs), [tabs]);

  /** 当前打开 Popover 的域名（null 代表全部关闭）——同时至多一个浮层 */
  const [activeDomain, setActiveDomain] = useState<string | null>(null);

  if (groups.length === 0) return null;

  /** Popover 内点击「跳转」：跳完顺手关闭浮层 */
  const handleJumpFromPopover = (tabId: number, windowId: number) => {
    void jumpToTab(tabId, windowId);
    setActiveDomain(null);
  };

  return (
    <div className="app-grid-view">
      {groups.map((group) => (
        <GridCard
          key={group.domain}
          domain={group.domain}
          colorKey={group.colorKey}
          tabs={group.tabs}
          onJump={(id, wid) => { void jumpToTab(id, wid); }}
          open={activeDomain === group.domain}
          onOpenChange={(next) =>
            setActiveDomain(next ? group.domain : null)
          }
          onJumpFromPopover={handleJumpFromPopover}
          onCloseTab={(id) => { void closeSingleTab(id); }}
          countLabel={t('header.tabCount', { count: group.tabs.length })}
        />
      ))}
    </div>
  );
}

interface GridCardProps {
  domain: string;
  colorKey: string;
  tabs: LiveTab[];
  onJump: (tabId: number, windowId: number) => void;
  /** Popover 开合受控——true 表示当前卡片的浮层展开 */
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onJumpFromPopover: (tabId: number, windowId: number) => void;
  onCloseTab: (tabId: number) => void;
  countLabel: string;
}

/**
 * 单张域名卡片
 */
function GridCard({
  domain,
  colorKey,
  tabs,
  onJump,
  open,
  onOpenChange,
  onJumpFromPopover,
  onCloseTab,
  countLabel,
}: GridCardProps) {
  const [faviconError, setFaviconError] = useState(false);
  const { token } = theme.useToken();
  const hasAudible = tabs.some((tab) => tab.audible);
  const first = tabs[0];
  const isMulti = tabs.length > 1;
  /** 从 favicon 提取主色（失败自动回退到 colorKey 哈希色）——与常用站点算法一致 */
  const accent = useAccent(first?.favIconUrl, colorKey);
  const color = accent.bar;

  /** 点击卡片：单 tab 直接跳，多 tab 切换 Popover */
  const handleCardClick = () => {
    if (isMulti) {
      onOpenChange(!open);
      return;
    }
    if (first) onJump(first.id, first.windowId);
  };

  const cardNode = (
    <Card
      onClick={handleCardClick}
      className="app-card-interactive app-grid-card"
      classNames={{ body: 'app-grid-card__body' }}
      style={{
        borderRadius: token.borderRadiusLG,
        ...cssVars({
          '--app-hover-border': token.colorPrimaryBorder,
          '--app-grid-card-accent': color,
        }),
      }}
    >
      {/* 缩略图区 —— 16:10 宽高比 */}
      <div className="app-grid-card-preview">
        {first?.favIconUrl && !faviconError ? (
          <img
            src={first.favIconUrl}
            alt=""
            className="app-grid-card-favicon"
            onError={() => setFaviconError(true)}
          />
        ) : (
          <span className="app-grid-card-fallback">
            {domain.charAt(0).toUpperCase()}
          </span>
        )}

        {/* 多 tab 角标：数字，右上角 */}
        {isMulti && (
          <span className="app-grid-card-count">
            {tabs.length}
          </span>
        )}
      </div>

      {/* 底部信息区 */}
      <div className="app-grid-card-content">
        <div className="app-grid-card-meta">
          <span className="app-grid-card-domain">
            {domain}
          </span>
          {hasAudible && (
            <Volume2 size={ICON_SIZE.SMALL} className="app-grid-card-audible" />
          )}
        </div>
        <span className="app-grid-card-copy">
          {countLabel}
        </span>
      </div>
    </Card>
  );

  // 单 tab 卡片：不需要 Popover 包裹，少一层节点
  if (!isMulti) return cardNode;

  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      trigger="click"
      placement="bottom"
      arrow
      destroyOnHidden
      classNames={{ container: 'app-grid-popover-container' }}
      overlayClassName="app-grid-popover-overlay"
      content={
        <DomainTabsPanel
          domain={domain}
          tabs={tabs}
          accentColor={color}
          faviconSrc={first?.favIconUrl}
          onJump={onJumpFromPopover}
          onCloseTab={onCloseTab}
          onClose={() => onOpenChange(false)}
        />
      }
    >
      {cardNode}
    </Popover>
  );
}

interface DomainTabsPanelProps {
  domain: string;
  tabs: LiveTab[];
  /** 域名身份色，用于标题行的左侧色条 */
  accentColor: string;
  faviconSrc?: string;
  onJump: (tabId: number, windowId: number) => void;
  onCloseTab: (tabId: number) => void;
  onClose: () => void;
}

/**
 * Popover 内容：域名多 tab 快速预览面板
 *
 * 布局：
 *   ┌────────────────────────────┐
 *   │ ▍[🌐] domain      N 个  ×  │  ← 紧凑 header，带色条 + favicon + 域名 + 计数 + 关闭
 *   ├────────────────────────────┤
 *   │   TabItem                   │
 *   │   TabItem                   │  ← 列表区，满高度滚动
 *   └────────────────────────────┘
 */
function DomainTabsPanel({
  domain,
  tabs,
  accentColor,
  faviconSrc,
  onJump,
  onCloseTab,
  onClose,
}: DomainTabsPanelProps) {
  const { t } = useT();
  const [faviconFailed, setFaviconFailed] = useState(false);

  /** 同组 title 重名 id 集合 —— 驱动 URL 消歧行 */
  const ambiguousIds = useMemo(() => findAmbiguousTitleIds(tabs), [tabs]);

  /**
   * 关闭某个 tab 后如果已没东西可看就收起浮层；
   * 由于 tabs 由父层实时下发，这里拿到的长度即为当前快照值。
   */
  const handleCloseTab = (id: number) => {
    onCloseTab(id);
    if (tabs.length <= 1) onClose();
  };

  const hasFavicon = typeof faviconSrc === 'string' && faviconSrc.length > 0;
  const popoverStyle: React.CSSProperties = cssVars({
    '--app-grid-popover-accent': accentColor,
  });

  return (
    <div className="app-grid-popover" style={popoverStyle}>
      {/* Header —— 色条 + favicon + 域名 + 计数 + 关闭 */}
      <div className="app-grid-popover__header">
        {/* 左侧身份色条 */}
        <span aria-hidden className="app-grid-popover__accent" />
        {/* favicon */}
        {hasFavicon && !faviconFailed ? (
          <img
            src={faviconSrc}
            alt=""
            className="app-grid-popover__favicon"
            onError={() => setFaviconFailed(true)}
          />
        ) : (
          <span aria-hidden className="app-grid-popover__fallback">
            {domain.charAt(0).toUpperCase()}
          </span>
        )}
        {/* 域名 —— 允许省略 */}
        <span title={domain} className="app-grid-popover__title">
          {domain}
        </span>
        {/* 计数 —— secondary tone，tabular */}
        <span className="app-grid-popover__count">
          {t('header.tabCount', { count: tabs.length })}
        </span>
        {/* 关闭按钮 —— antd Button（键盘可达 + ant 原生样式） */}
        <Button
          type="text"
          size="small"
          aria-label="Close"
          onClick={onClose}
          icon={<X size={ICON_SIZE.MEDIUM} />}
          className="app-grid-popover__close"
        />
      </div>

      {/* 列表区 */}
      <div className="app-grid-popover__list">
        {tabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            onJump={onJump}
            onClose={handleCloseTab}
            showUrlHint={ambiguousIds.has(tab.id)}
          />
        ))}
      </div>
    </div>
  );
}
