/**
 * TabItem — 标签行（antd 版）
 *
 * 设计：
 *   - 36px 行高，与其它紧凑行对齐
 *   - favicon 15×15 + 内容区 + 状态图标 + hover 显示关闭按钮
 *   - hover 态使用 antd token 的 colorFillTertiary
 *   - 可选 leading slot：由调用方传入的前置元素（如序号徽章），与行整体共享 hover
 *   - 可选 showHostname：在跨域名列表场景（Timeline / Frequency）展示主机名
 *   - 所有交互走 antd Button + Tag + Tooltip 原生组件
 */

import { useState } from 'react';
import type { LiveTab } from '@/shared/types';
import { Button, Tag, Tooltip, theme } from 'antd';
import {
  GlobalOutlined,
  SoundOutlined,
  PushpinFilled,
  MessageOutlined,
  CloseOutlined,
  SelectOutlined,
} from '@ant-design/icons';
import { useT } from '@/shared/i18n';
import { useMetadataStore } from '@/store';
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
}

/**
 * 单条标签行
 */
export function TabItem({ tab, onJump, onClose, leading, showHostname = false, hideFavicon = false, showUrlHint = false, trailing }: TabItemProps) {
  const { t } = useT();
  const { token } = theme.useToken();
  const isPinned = useMetadataStore((s) => s.isPinned(tab.url));
  const tags = useMetadataStore((s) => s.getTags(tab.url));
  const note = useMetadataStore((s) => s.getNote(tab.url));
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [faviconError, setFaviconError] = useState(false);
  const [hovered, setHovered] = useState(false);
  /** 休眠态——标签已被浏览器丢弃，显示灰色样式 */
  const isDiscarded = tab.discarded ?? false;

  /** 友好展示串：路径 + 关键参数，失败回落到原 URL */
  const urlHint = showUrlHint ? formatUrlForDisplay(tab.url) : '';

  const handleClick = () => onJump(tab.id, tab.windowId);
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

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
        onContextMenu={handleContextMenu}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          minHeight: showUrlHint ? 48 : 36,
          padding: showUrlHint ? '6px 10px' : '0 10px',
          borderRadius: token.borderRadius,
          cursor: 'pointer',
          backgroundColor: hovered ? token.colorFillTertiary : 'transparent',
          transition: `background-color ${token.motionDurationFast}`,
          outline: 'none',
          opacity: isDiscarded ? 0.5 : 1,
        }}
      >
        {leading}

        {/* Favicon（可通过 hideFavicon 整体隐藏，行内元素间距由父级 gap 负责） */}
        {!hideFavicon && (
          tab.favIconUrl && !faviconError ? (
            <img
              src={tab.favIconUrl}
              alt=""
              style={{ width: 15, height: 15, borderRadius: 3, flexShrink: 0 }}
              onError={() => setFaviconError(true)}
            />
          ) : (
            <div
              style={{
                width: 15,
                height: 15,
                borderRadius: 3,
                background: token.colorFillSecondary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <GlobalOutlined style={{ fontSize: 10, color: token.colorTextTertiary }} />
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
              <PushpinFilled style={{ fontSize: 10, color: token.colorPrimary, flexShrink: 0 }} />
            )}
            {note && (
              <MessageOutlined
                style={{ fontSize: 10, color: token.colorTextTertiary, flexShrink: 0 }}
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
              <SoundOutlined style={{ fontSize: 12, color: token.colorPrimary }} />
            </Tooltip>
          )}
          {!tab.isCurrentWindow && (
            <Tooltip title={t('tabs.otherWindow')}>
              {/* 使用外链箭头图标表达「跳去另一个窗口」语义，避免与 favicon 兜底的 Global 图标混淆 */}
              <SelectOutlined style={{ fontSize: 12, color: token.colorTextTertiary }} />
            </Tooltip>
          )}
        </div>

        {/* 行尾附加信息（如时间戳），放在状态图标和关闭按钮之间 */}
        {trailing}

        {/* 关闭按钮（hover 显示） */}
        <Tooltip title={t('tabs.close')}>
          <Button
            type="text"
            size="small"
            danger
            icon={<CloseOutlined style={{ fontSize: 12 }} />}
            onClick={handleClose}
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
