/**
 * CompactView — 虚拟化平铺列表（antd 版）
 *
 * 设计：
 *   - 按 lastAccessed 降序；一屏可见 ≥20 条
 *   - 行高 36px，信息密度高于 DomainGroupCard
 *   - 使用虚拟滚动，支持 500+ Tab 不掉帧
 *   - 容器高度用 `min(100vh - 240px, tabs * 36)`，短列表不撑开，长列表滚动
 */

import { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTabsStore } from '@/store';
import { useT } from '@/shared/i18n';
import {
  GlobalOutlined,
  SoundOutlined,
  PushpinFilled,
  CloseOutlined,
  SelectOutlined,
} from '@ant-design/icons';
import { Button, Tooltip, theme } from 'antd';
import type { LiveTab } from '@/shared/types';

const ROW_HEIGHT = 36;
/** 容器最大高度（留给 Header + Hero + pb 的空间） */
const VIEWPORT_RESERVE = 240;

/**
 * 紧凑视图：虚拟化列表
 */
export function CompactView() {
  const tabs = useTabsStore((s) => s.tabs);
  const jumpToTab = useTabsStore((s) => s.jumpToTab);
  const closeSingleTab = useTabsStore((s) => s.closeSingleTab);
  const { t } = useT();

  const sortedTabs = useMemo(
    () => [...tabs].sort((a, b) => b.lastAccessed - a.lastAccessed),
    [tabs]
  );

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: sortedTabs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  if (sortedTabs.length === 0) return null;

  /** 短列表不撑满视口；长列表按视口高度滚动 */
  const containerMaxHeight = `min(calc(100vh - ${VIEWPORT_RESERVE}px), ${sortedTabs.length * ROW_HEIGHT + 8}px)`;

  return (
    <div
      ref={parentRef}
      style={{
        overflowY: 'auto',
        paddingRight: 4,
        maxHeight: containerMaxHeight,
        minHeight: Math.min(sortedTabs.length, 6) * ROW_HEIGHT,
      }}
    >
      <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const tab = sortedTabs[virtualRow.index];
          return (
            <CompactRow
              key={tab.id}
              tab={tab}
              top={virtualRow.start}
              height={virtualRow.size}
              onJump={jumpToTab}
              onClose={closeSingleTab}
              closeLabel={t('tabs.close')}
              otherWindowLabel={t('tabs.otherWindow')}
            />
          );
        })}
      </div>
    </div>
  );
}

interface CompactRowProps {
  tab: LiveTab;
  top: number;
  height: number;
  onJump: (tabId: number, windowId: number) => void;
  onClose: (tabId: number) => void;
  closeLabel: string;
  /** 「位于其他窗口」提示文案，供 Tooltip 展示 */
  otherWindowLabel: string;
}

/**
 * 单条虚拟行
 */
function CompactRow({ tab, top, height, onJump, onClose, closeLabel, otherWindowLabel }: CompactRowProps) {
  const [faviconError, setFaviconError] = useState(false);
  const [hovered, setHovered] = useState(false);
  const { token } = theme.useToken();

  return (
    <div
      role="button"
      tabIndex={0}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height,
        transform: `translateY(${top}px)`,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 12px',
        borderRadius: token.borderRadius,
        cursor: 'pointer',
        background: hovered ? token.colorFillTertiary : 'transparent',
        transition: `background ${token.motionDurationFast}`,
        outline: 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onJump(tab.id, tab.windowId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onJump(tab.id, tab.windowId);
        }
      }}
    >
      {tab.favIconUrl && !faviconError ? (
        <img
          src={tab.favIconUrl}
          alt=""
          style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0 }}
          onError={() => setFaviconError(true)}
        />
      ) : (
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: 3,
            background: token.colorFillSecondary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <GlobalOutlined style={{ fontSize: 11, color: token.colorTextTertiary }} />
        </div>
      )}

      <span
        style={{
          fontSize: 13,
          color: token.colorText,
          flex: 1,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          lineHeight: 1.3,
        }}
      >
        {tab.title}
      </span>
      <span
        style={{
          fontSize: 11.5,
          color: token.colorTextTertiary,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: 200,
          lineHeight: 1.3,
          flexShrink: 0,
        }}
      >
        {tab.hostname}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        {tab.pinned && <PushpinFilled style={{ fontSize: 11, color: token.colorPrimary }} />}
        {tab.audible && <SoundOutlined style={{ fontSize: 11, color: token.colorPrimary }} />}
        {!tab.isCurrentWindow && (
          <Tooltip title={otherWindowLabel}>
            {/* 与 TabItem 保持一致：用 SelectOutlined 表示「其他窗口」，避免与 favicon 兜底的 Global 图标混淆 */}
            <SelectOutlined style={{ fontSize: 11, color: token.colorTextTertiary }} />
          </Tooltip>
        )}
      </div>

      <Tooltip title={closeLabel}>
        <Button
          type="text"
          size="small"
          danger
          icon={<CloseOutlined style={{ fontSize: 12 }} />}
          onClick={(e) => {
            e.stopPropagation();
            onClose(tab.id);
          }}
          style={{
            flexShrink: 0,
            opacity: hovered ? 1 : 0,
            transition: `opacity ${token.motionDurationFast}`,
            width: 24,
            height: 24,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        />
      </Tooltip>
    </div>
  );
}
