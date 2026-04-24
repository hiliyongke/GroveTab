/**
 * TabItem — 标签行（antd 版）
 *
 * 设计：
 *   - 40px 行高（比原 36px 更宽松），与其它紧凑行对齐
 *   - favicon 16×16（比原 15×15 更清晰）+ 内容区 + 状态图标 + hover 显示关闭按钮
 *   - hover 态使用 antd token 的 colorFillTertiary + 微妙左侧色条
 *   - 可选 leading slot：由调用方传入的前置元素（如序号徽章），与行整体共享 hover
 *   - 可选 showHostname：在跨域名列表场景（Timeline / Frequency）展示主机名
 *   - 所有交互走 antd Button + Tag + Tooltip 原生组件
 */

import { useState, useCallback } from 'react';
import type { LiveTab } from '@/shared/types';
import { Button, Tag, Tooltip, Checkbox, theme } from 'antd';
import {
  Globe,
  Volume2,
  Pin,
  MessageSquare,
  X,
  Pointer,
} from 'lucide-react';
import { useT } from '@/shared/i18n';
import { useMetadataStore, useSelectionStore } from '@/store';
import { stringToColor } from '@/shared/utils/color';
import { formatUrlForDisplay } from '@/shared/utils/url-display';
import { TabContextMenu } from './TabContextMenu';

interface TabItemProps {
  tab: LiveTab;
  onJump: (tabId: number, windowId: number) => void;
  onClose: (tabId: number) => void;
  /**
   * 行首前置 slot（序号、选中框等），进入 hover 背景区域一起高亮
   */
  leading?: React.ReactNode;
  /**
   * 是否在行首显示域名（用于跨域名列表，如时间轴/频率视图）
   */
  showHostname?: boolean;
  /**
   * 是否隐藏 favicon（包含加载失败时的占位块）。
   * 用于域名分组视图：用户可通过设置关闭子项 favicon 以获得更紧凑的视觉。
   * 关闭后 TabItem 左侧不再占用图标栏位。
   */
  hideFavicon?: boolean;
  /**
   * 是否在标题下方补一行"URL 友好串"用于消歧。
   * 适用于同域名/同标题的多个 tab（只靠 title 分不清）。
   * 启用后行高自动扩展为双行（约 48px）
   */
  showUrlHint?: boolean;
  /**
   * 行尾附加节点（状态图标与关闭按钮之间），用于显示时间戳等辅助信息
   */
  trailing?: React.ReactNode;
  /**
   * 是否支持多选（由父视图决定是否启用）。
   * 启用后行首显示 Checkbox，长按/Ctrl+点击/Shift+点击触发多选。
   */
  selectable?: boolean;
  /**
   * 当前视图内所有可见 tab ID 列表（用于 Shift 范围选）。
   * 仅在 selectable=true 时需要传入。
   */
  visibleTabIds?: number[];
}

/**
 * 单条标签行
 */
export function TabItem({ tab, onJump, onClose, leading, showHostname = false, hideFavicon = false, showUrlHint = false, trailing, selectable = false, visibleTabIds = [] }: TabItemProps) {
  const { t } = useT();
  const { token } = theme.useToken();
  const isPinned = useMetadataStore((s) => s.isPinned(tab.url));
  const tags = useMetadataStore((s) => s.getTags(tab.url));
  const note = useMetadataStore((s) => s.getNote(tab.url));
  /** 多选状态 */
  const selectionMode = useSelectionStore((s) => s.selectionMode);
  const isSelected = useSelectionStore((s) => s.selectedIds.has(tab.id));
  const toggleSelect = useSelectionStore((s) => s.toggleSelect);
  const enterSelectionMode = useSelectionStore((s) => s.enterSelectionMode);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [faviconError, setFaviconError] = useState(false);
  /** 休眠态——标签已被浏览器丢弃，显示灰色样式 */
  const isDiscarded = tab.discarded ?? false;

  /** 友好展示串：路径 + 关键参数，失败回落到原 URL */
  const urlHint = showUrlHint ? formatUrlForDisplay(tab.url) : '';

  /** 多选模式下点击逻辑：Ctrl/Cmd+点击 或 selectionMode 已开启时切换选中 */
  const handleClick = useCallback((e: React.MouseEvent) => {
    // 多选模式下的点击逻辑
    if (selectable && (e.ctrlKey || e.metaKey || selectionMode)) {
      e.preventDefault();
      toggleSelect(tab.id, e.shiftKey, visibleTabIds);
      return;
    }
    // 正常点击：跳转标签
    onJump(tab.id, tab.windowId);
  }, [selectable, selectionMode, tab.id, tab.windowId, toggleSelect, visibleTabIds, onJump]);

  /** 长按进入多选模式 */
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 如果支持多选且不在多选模式，右键也作为多选入口之一
    if (selectable && !selectionMode) {
      enterSelectionMode();
      toggleSelect(tab.id, false, visibleTabIds);
      return;
    }
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, [selectable, selectionMode, tab.id, visibleTabIds, enterSelectionMode, toggleSelect]);
  /**
   * 关闭按钮 handler：
   *   - onClose (即 store.closeSingleTab) 是 async，失败会 throw
   *   - 这里用 void + catch 吞掉 rejection，避免浏览器抛 unhandled promise 警告
   *   - 失败 toast 已由 store 统一弹出，此处无需再次提示
   */
  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    void Promise.resolve(onClose(tab.id)).catch(() => {
      /* store 已 toast，此处吞掉 */
    });
  };

  /** 选中态背景色 */
  const selectedBg = token.colorPrimaryBg;

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            // 多选模式下空格/回车切换选中
            if (selectable && selectionMode) {
              toggleSelect(tab.id, false, visibleTabIds);
              return;
            }
            onJump(tab.id, tab.windowId);
          }
        }}
        onContextMenu={handleContextMenu}
        className="canopy-row-hover canopy-hover-reveal-host"
        style={
          {
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            minHeight: showUrlHint ? 52 : 40,
            padding: showUrlHint ? '8px 12px' : '4px 12px',
            borderRadius: token.borderRadiusSM,
            cursor: 'pointer',
            // 选中态用内联 background 强制覆盖 hover 规则；非选中态留空让 CSS
            // .canopy-row-hover:hover 接管（空字符串/undefined 都不会产生内联规则）
            ...(isSelected ? { backgroundColor: selectedBg } : {}),
            outline: 'none',
            opacity: isDiscarded ? 0.5 : 1,
            position: 'relative',
            // 向 .canopy-row-hover 下发自定义 hover 背景色（与原 colorFillTertiary 一致）
            ['--canopy-row-hover-bg' as string]: token.colorFillTertiary,
          } as React.CSSProperties
        }
      >
        {/* 多选 Checkbox——仅在 selectable 且处于多选模式时显示 */}
        {selectable && (selectionMode || isSelected) && (
          <Checkbox
            checked={isSelected}
            onClick={(e) => {
              e.stopPropagation();
              toggleSelect(tab.id, e.shiftKey, visibleTabIds);
            }}
            style={{ flexShrink: 0 }}
          />
        )}

        {leading}

        {/* Favicon（可通过 hideFavicon 整体隐藏，行内元素间距由父级 gap 负责） */}
        {!hideFavicon && (
          tab.favIconUrl && !faviconError ? (
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
              <Globe size={10} style={{ color: token.colorTextTertiary }} />
            </div>
          )
        )}

        {/* 标题区（单行或双行，取决于是否需要 URL 消歧） */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: showUrlHint ? 2 : 0,
          }}
        >
          {/* 上行：标题 + 标记 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 500,
                color: token.colorText,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: 1.3,
                flex: '0 1 auto',
                minWidth: 0,
              }}
            >
              {tab.title}
            </span>
            {showHostname && (
              <span
                style={{
                  fontSize: 11,
                  color: token.colorTextTertiary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  flexShrink: 0,
                  maxWidth: 160,
                }}
              >
                {tab.hostname}
              </span>
            )}
            {isPinned && (
              <Pin size={10} style={{ color: token.colorPrimary, flexShrink: 0 }} />
            )}
            {note && (
              <MessageSquare
                size={10}
                style={{ color: token.colorTextTertiary, flexShrink: 0 }}
              />
            )}
            {tags.slice(0, 2).map((tag) => (
              <Tag
                key={tag}
                style={{
                  margin: 0,
                  height: 16,
                  lineHeight: '14px',
                  padding: '0 5px',
                  fontSize: 10,
                  borderRadius: 3,
                  color: '#fff',
                  border: 'none',
                  backgroundColor: stringToColor(tag),
                  flexShrink: 0,
                }}
              >
                {tag}
              </Tag>
            ))}
          </div>

          {/* 下行：URL 友好串（仅同名多 tab 时展示） */}
          {showUrlHint && urlHint && (
            <Tooltip title={tab.url} mouseEnterDelay={0.4} placement="bottomLeft">
              <span
                style={{
                  display: 'block',
                  fontSize: 11,
                  color: token.colorTextTertiary,
                  fontFamily:
                    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  lineHeight: 1.3,
                }}
              >
                {urlHint}
              </span>
            </Tooltip>
          )}
        </div>

        {/* 状态图标 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {tab.audible && (
            <Tooltip title={t('tabs.playing')}>
              <Volume2 size={12} style={{ color: token.colorPrimary }} />
            </Tooltip>
          )}
          {!tab.isCurrentWindow && (
            <Tooltip title={t('tabs.otherWindow')}>
              {/* 使用外链箭头图标表达「跳去另一个窗口」语义，避免与 favicon 兜底的 Global 图标混淆 */}
              <Pointer size={12} style={{ color: token.colorTextTertiary }} />
            </Tooltip>
          )}
        </div>

        {/* 行尾附加信息（如时间戳），放在状态图标和关闭按钮之间 */}
        {trailing}

        {/* 关闭按钮（hover/focus 时显示，由父节点 .canopy-hover-reveal-host 驱动） */}
        <Tooltip title={t('tabs.close')}>
          <Button
            type="text"
            size="small"
            danger
            icon={<X size={12} />}
            onClick={handleClose}
            className="canopy-hover-reveal"
            style={{
              flexShrink: 0,
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

      {/* 右键菜单——仅非多选模式下显示完整菜单 */}
      {contextMenu && (
        <TabContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          url={tab.url}
          tabId={tab.id}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}
