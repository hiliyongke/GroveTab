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
import { useTabsStore } from '@/store';
import { useT } from '@/shared/i18n';
import { groupTabsByDomain, getGroupFavicon } from '@/shared/utils/domain';
import { useAccent } from '@/shared/hooks/useAccent';
import { useGroupAccents } from '@/shared/hooks/useGroupAccents';
import { findAmbiguousTitleIds } from '@/shared/utils/url-display';
import { TabItem } from './TabItem';
import type { LiveTab } from '@/shared/types';
import type { Accent } from '@/shared/utils/favicon-color';

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

  /**
   * 批次内去重分配 Accent——与 DomainGroupView 同策略，
   * 避免大量 GridCard 并排时哈希撞色。
   * 注意：hooks 必须在 early return 前调用。
   */
  const accentInputs = useMemo(
    () =>
      groups.map((g) => ({
        colorKey: g.colorKey,
        favicon: getGroupFavicon(g.tabs),
      })),
    [groups],
  );
  const accentMap = useGroupAccents(accentInputs);

  if (groups.length === 0) return null;

  /** Popover 内点击「跳转」：跳完顺手关闭浮层 */
  const handleJumpFromPopover = (tabId: number, windowId: number) => {
    void jumpToTab(tabId, windowId);
    setActiveDomain(null);
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 12,
      }}
    >
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
          accentOverride={accentMap[group.colorKey]}
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
  /** 父层批次去重后的 Accent；未提供则退回单独 `useAccent` */
  accentOverride?: Accent;
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
  accentOverride,
}: GridCardProps) {
  const [faviconError, setFaviconError] = useState(false);
  const { token } = theme.useToken();
  const hasAudible = tabs.some((tab) => tab.audible);
  const first = tabs[0];
  const isMulti = tabs.length > 1;
  /** 从 favicon 提取主色（失败自动回退到 colorKey 哈希色） */
  const localAccent = useAccent(first?.favIconUrl, colorKey);
  /** 父层注入优先，保证同一批 GridCard 内不撞色 */
  const accent = accentOverride ?? localAccent;
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
      className="canopy-card-interactive canopy-grid-card"
      styles={{
        body: {
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        },
      }}
      style={
        {
          borderRadius: token.borderRadiusLG,
          cursor: 'pointer',
          // 下发 hover 边框色给 canopy-card-interactive 消费
          ['--canopy-hover-border' as string]: token.colorPrimaryBorder,
        } as React.CSSProperties
      }
    >
      {/* 缩略图区 —— 16:10 宽高比 */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 10',
          borderRadius: token.borderRadius,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `linear-gradient(135deg, ${color}18 0%, ${color}08 100%)`,
        }}
      >
        {first?.favIconUrl && !faviconError ? (
          <img
            src={first.favIconUrl}
            alt=""
            style={{ width: 36, height: 36, borderRadius: 6 }}
            onError={() => setFaviconError(true)}
          />
        ) : (
          <span style={{ fontSize: 24, fontWeight: 700, lineHeight: 1, color }}>
            {domain.charAt(0).toUpperCase()}
          </span>
        )}

        {/* 多 tab 角标：数字，右上角 */}
        {isMulti && (
          <span
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              minWidth: 22,
              height: 20,
              padding: '0 6px',
              borderRadius: 10,
              background: token.colorBgElevated,
              border: `1px solid ${token.colorBorderSecondary}`,
              boxShadow: token.boxShadowTertiary,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 600,
              color: token.colorText,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {tabs.length}
          </span>
        )}
      </div>

      {/* 域名 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: token.colorText,
            flex: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: 1.3,
          }}
        >
          {domain}
        </span>
        {hasAudible && (
          <Volume2 size={12} style={{ color: token.colorPrimary, flexShrink: 0 }} />
        )}
      </div>

      {/* 计数行 */}
      <span
        style={{
          fontSize: 11.5,
          color: token.colorTextTertiary,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.3,
        }}
      >
        {countLabel}
      </span>
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
      overlayInnerStyle={{ padding: 0 }}
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
  const { token } = theme.useToken();
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

  return (
    <div
      style={{
        width: 340,
        maxWidth: 'calc(100vw - 32px)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header —— 色条 + favicon + 域名 + 计数 + 关闭 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 8px 10px 12px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        {/* 左侧身份色条 */}
        <span
          aria-hidden
          style={{
            width: 3,
            alignSelf: 'stretch',
            borderRadius: 2,
            background: accentColor,
            flexShrink: 0,
          }}
        />
        {/* favicon */}
        {hasFavicon && !faviconFailed ? (
          <img
            src={faviconSrc}
            alt=""
            width={16}
            height={16}
            style={{ borderRadius: 3, flexShrink: 0 }}
            onError={() => setFaviconFailed(true)}
          />
        ) : (
          <span
            aria-hidden
            style={{
              width: 16,
              height: 16,
              borderRadius: 3,
              background: `${accentColor}22`,
              color: accentColor,
              fontSize: 10,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {domain.charAt(0).toUpperCase()}
          </span>
        )}
        {/* 域名 —— 允许省略 */}
        <span
          title={domain}
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 13,
            fontWeight: 600,
            color: token.colorText,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: 1.3,
          }}
        >
          {domain}
        </span>
        {/* 计数 —— secondary tone，tabular */}
        <span
          style={{
            fontSize: 12,
            color: token.colorTextTertiary,
            fontVariantNumeric: 'tabular-nums',
            flexShrink: 0,
          }}
        >
          {t('header.tabCount', { count: tabs.length })}
        </span>
        {/* 关闭按钮 —— antd Button（键盘可达 + ant 原生样式） */}
        <Button
          type="text"
          size="small"
          aria-label="Close"
          onClick={onClose}
          icon={<X size={14} />}
          style={{ flexShrink: 0 }}
        />
      </div>

      {/* 列表区 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          padding: '4px 4px 8px',
          maxHeight: 'min(60vh, 420px)',
          overflowY: 'auto',
        }}
      >
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
