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
 *   - **多 tab**：点击弹出 Modal（居中、带遮罩、淡入），展示完整列表
 *     选用 Modal 而非 Popover 的理由：
 *       1. 卡片偏小，Popover 贴卡片显得局促，长列表易越界
 *       2. Modal 居中 + 遮罩，层次清晰，与"查看该域名全部 tab"的重操作匹配
 *       3. 无 outside-click 误判问题，交互更稳定
 *       4. 支持 Esc 关闭 + 自带淡入淡出动画
 */

import { useMemo, useState } from 'react';
import { Card, Modal, theme } from 'antd';
import { SoundOutlined } from '@ant-design/icons';
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

  /** 当前打开的域名分组（null 代表关闭） */
  const [activeDomain, setActiveDomain] = useState<string | null>(null);
  const activeGroup = useMemo(
    () => groups.find((g) => g.domain === activeDomain) ?? null,
    [groups, activeDomain],
  );

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

  /** 弹窗内点击「跳转」：跳完顺手关闭弹窗 */
  const handleJumpFromModal = (tabId: number, windowId: number) => {
    jumpToTab(tabId, windowId);
    setActiveDomain(null);
  };

  return (
    <>
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
            onJump={jumpToTab}
            onOpenList={() => setActiveDomain(group.domain)}
            countLabel={t('header.tabCount', { count: group.tabs.length })}
            accentOverride={accentMap[group.colorKey]}
          />
        ))}
      </div>

      <DomainTabsModal
        group={activeGroup}
        onClose={() => setActiveDomain(null)}
        onJump={handleJumpFromModal}
        onCloseTab={closeSingleTab}
      />
    </>
  );
}

interface GridCardProps {
  domain: string;
  colorKey: string;
  tabs: LiveTab[];
  onJump: (tabId: number, windowId: number) => void;
  onOpenList: () => void;
  countLabel: string;
  /** 父层批次去重后的 Accent；未提供则退回单独 `useAccent` */
  accentOverride?: Accent;
}

/**
 * 单张域名卡片
 */
function GridCard({ domain, colorKey, tabs, onJump, onOpenList, countLabel, accentOverride }: GridCardProps) {
  const [faviconError, setFaviconError] = useState(false);
  const [hovered, setHovered] = useState(false);
  const { token } = theme.useToken();
  const hasAudible = tabs.some((tab) => tab.audible);
  const first = tabs[0];
  const isMulti = tabs.length > 1;
  /** 从 favicon 提取主色（失败自动回退到 colorKey 哈希色） */
  const localAccent = useAccent(first?.favIconUrl, colorKey);
  /** 父层注入优先，保证同一批 GridCard 内不撞色 */
  const accent = accentOverride ?? localAccent;
  const color = accent.bar;

  /** 点击卡片：单 tab 直接跳，多 tab 触发弹窗 */
  const handleCardClick = () => {
    if (isMulti) {
      onOpenList();
      return;
    }
    if (first) onJump(first.id, first.windowId);
  };

  return (
    <Card
      hoverable
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleCardClick}
      styles={{
        body: {
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        },
      }}
      style={{
        borderRadius: token.borderRadiusLG,
        cursor: 'pointer',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        borderColor: hovered ? token.colorPrimaryBorder : token.colorBorderSecondary,
        transition: `transform ${token.motionDurationMid}, border-color ${token.motionDurationMid}, box-shadow ${token.motionDurationMid}`,
      }}
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
          <SoundOutlined style={{ fontSize: 12, color: token.colorPrimary, flexShrink: 0 }} />
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
}

interface DomainTabsModalProps {
  group: { domain: string; colorKey: string; tabs: LiveTab[] } | null;
  onClose: () => void;
  onJump: (tabId: number, windowId: number) => void;
  onCloseTab: (tabId: number) => void;
}

/**
 * 域名多 tab 弹窗
 *
 * 使用顶层单例而非每卡片一个 Modal：
 *   - 节省开销
 *   - 同一时刻至多一个弹窗，语义更单纯
 *   - 关闭动画走 antd 自带过渡
 */
function DomainTabsModal({ group, onClose, onJump, onCloseTab }: DomainTabsModalProps) {
  const { token } = theme.useToken();
  const { t } = useT();
  /**
   * 冻结最后一次 group，关闭时仍保留内容参与淡出动画
   */
  const [snapshot, setSnapshot] = useState<DomainTabsModalProps['group']>(null);
  if (group && group !== snapshot) setSnapshot(group);

  const display = group ?? snapshot;
  const open = group !== null;

  /** 同组 title 重名 id 集合 —— 驱动 URL 消歧行 */
  const ambiguousIds = useMemo(
    () => (display ? findAmbiguousTitleIds(display.tabs) : new Set<number>()),
    [display],
  );

  if (!display) return null;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      afterClose={() => setSnapshot(null)}
      footer={null}
      width={520}
      centered
      destroyOnHidden
      title={
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: token.colorText }}>
            {display.domain}
          </span>
          <span
            style={{
              fontSize: 12,
              color: token.colorTextTertiary,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {t('header.tabCount', { count: display.tabs.length })}
          </span>
        </div>
      }
      styles={{
        body: {
          padding: 0,
          maxHeight: '60vh',
          overflowY: 'auto',
        },
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          padding: '4px 4px 8px',
        }}
      >
        {display.tabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            onJump={onJump}
            onClose={onCloseTab}
            showUrlHint={ambiguousIds.has(tab.id)}
          />
        ))}
      </div>
    </Modal>
  );
}
