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

import { useState, useCallback, useMemo, memo } from 'react';
import type { LiveTab } from '@/shared/types';
import { Button, Tag, Tooltip, Checkbox, theme } from 'antd';
import { Globe,
  Volume2,
  Pin,
  MessageSquare,
  X,
  Pointer,
  Star,
} from 'lucide-react';
import { cssVars } from '@/shared/utils/css-vars';import { useT } from '@/shared/i18n';
import { useMetadataStore, useSelectionStore, useSpeedDialStore } from '@/store';
import { stringToColor } from '@/shared/utils/color';
import { ICON_SIZE } from '@/shared/utils/icon-size';
import { formatUrlForDisplay } from '@/shared/utils/url-display';
import { TabContextMenu } from './TabContextMenu';
import styles from './styles/items.module.less';

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
 * 单条标签行组件
 *
 * 渲染单个标签页的行项，包含 favicon、标题、状态图标和操作按钮。
 * 支持多选模式、右键菜单、拖拽等交互。
 *
 * @param props - 组件属性
 * @param props.tab - 标签数据
 * @param props.onJump - 跳转回调
 * @param props.onClose - 关闭回调
 * @param props.leading - 行首前置元素（可选）
 * @param props.showHostname - 是否显示域名（可选）
 * @param props.hideFavicon - 是否隐藏 favicon（可选）
 * @param props.showUrlHint - 是否显示 URL 消歧提示（可选）
 * @param props.trailing - 行尾附加元素（可选）
 * @param props.selectable - 是否支持多选（可选）
 * @param props.visibleTabIds - 当前视图可见标签 ID 列表（可选）
 * @returns 单条标签行 JSX 元素
 */
export const TabItem = memo(function TabItem({ tab, onJump, onClose, leading, showHostname = false, hideFavicon = false, showUrlHint = false, trailing, selectable = false, visibleTabIds = [] }: TabItemProps) {
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
  const speedDialSites = useSpeedDialStore((s) => s.sites);
  const addSite = useSpeedDialStore((s) => s.addSite);
  /**
   * 标准化 URL：去掉协议前缀和常见跟踪参数，用于去重比较
   *
   * @param url - 要标准化的 URL 字符串
   * @returns 标准化后的 URL 字符串
   */
  const normalizeUrl = (url: string): string => {
    try {
      const u = new URL(url);
      const dropParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'];
      dropParams.forEach((p) => u.searchParams.delete(p));
      u.hash = '';
      return u.host + u.pathname.replace(/\/+$/, '') + u.search;
    } catch {
      return url;
    }
  };
  /** 当前标签是否已在常用站点中 */
  const isInQuickStart = speedDialSites.some((s) => normalizeUrl(s.url) === normalizeUrl(tab.url));
  /** 休眠态——标签已被浏览器丢弃，显示灰色样式 */
  const isDiscarded = tab.discarded ?? false;

  /** 友好展示串：路径 + 关键参数，失败回落到原 URL */
  const urlHint = showUrlHint ? formatUrlForDisplay(tab.url) : '';

  /**
   * 处理标签行点击事件
   *
   * 多选模式下 Ctrl/Cmd+点击或 selectionMode 已开启时切换选中状态。
   * 正常点击时跳转至对应标签。
   *
   * @param e - 鼠标点击事件
   * @returns 无返回值
   */
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

  /**
   * 处理右键菜单事件
   *
   * 长按进入多选模式，或显示右键菜单。
   *
   * @param e - 鼠标事件
   * @returns 无返回值
   */
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
   * 处理标签关闭按钮点击
   *
   * onClose (即 store.closeSingleTab) 是 async，失败会 throw。
   * 这里用 void + catch 吞掉 rejection，避免浏览器抛 unhandled promise 警告。
   * 失败 toast 已由 store 统一弹出，此处无需再次提示。
   *
   * @param e - 鼠标事件
   * @returns 无返回值
   */
  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    void Promise.resolve(onClose(tab.id)).catch(() => {
      /* store 已 toast，此处吞掉 */
    });
  };

  /** 选中态背景色 */
  const selectedBg = token.colorPrimaryBg;
  const rowStyle = useMemo<React.CSSProperties>(
    () => cssVars({
      '--app-row-hover-bg': token.colorFillTertiary,
      '--app-tab-selected-bg': selectedBg,
      '--app-tab-text': token.colorText,
      '--app-tab-text-tertiary': token.colorTextTertiary,
      '--app-tab-primary': token.colorPrimary,
      '--app-tab-fallback-bg': token.colorFillSecondary,
    }),
    [selectedBg, token.colorFillSecondary, token.colorFillTertiary, token.colorPrimary, token.colorText, token.colorTextTertiary],
  );
  const tagStyles = useMemo(
    () => new Map(tags.slice(0, 2).map((tag) => [tag, cssVars({ '--app-tab-item-tag-bg': stringToColor(tag) })])),
    [tags],
  );

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
        className={[
          'app-row-hover',
          'app-hover-reveal-host',
          styles['app-tab-item'],
          showUrlHint ? styles['has-url-hint'] : '',
          isSelected ? styles['is-selected'] : '',
          isDiscarded ? styles['is-discarded'] : '',
        ].filter(Boolean).join(' ')}
        style={rowStyle}
      >
        {/* 多选 Checkbox——selectable 时始终占位，非多选模式用 visibility:hidden 隐藏，避免布局跳动 */}
        {selectable && (
          <Checkbox
            checked={isSelected}
            onClick={(e) => {
              e.stopPropagation();
              toggleSelect(tab.id, e.shiftKey, visibleTabIds);
            }}
            className={`${styles['app-tab-item-checkbox']}${selectionMode || isSelected ? ` ${styles['is-visible']}` : ''}`}
          />
        )}

        {leading}

        {/* Favicon（可通过 hideFavicon 整体隐藏，行内元素间距由父级 gap 负责） */}
        {!hideFavicon && (
          tab.favIconUrl && !faviconError ? (
            <img
              src={tab.favIconUrl}
              alt=""
              className={styles['app-tab-item-favicon']}
              onError={() => setFaviconError(true)}
            />
          ) : (
            <div className={styles['app-tab-item-favicon-fallback']}>
              <Globe size={ICON_SIZE.MICRO} className={styles['app-tab-item-favicon-icon']} />
            </div>
          )
        )}

        {/* 标题区（单行或双行，取决于是否需要 URL 消歧） */}
        <div className={styles['app-tab-item-main']}>
          {/* 上行：标题 + 标记 */}
          <div className={styles['app-tab-item-head']}>
            <span className={styles['app-tab-item-title']}>
              {tab.title}
            </span>
            {showHostname && (
              <span className={styles['app-tab-item-hostname']}>
                {tab.hostname}
              </span>
            )}
            {isPinned && (
            <Pin size={ICON_SIZE.MICRO} className={styles['app-tab-item-status-primary']} />
            )}
            {note && (
            <MessageSquare size={ICON_SIZE.MICRO} className={styles['app-tab-item-note-icon']} />
            )}
            {tags.slice(0, 2).map((tag) => (
              <Tag
                key={tag}
                className={styles['app-tab-item-tag']}
                style={tagStyles.get(tag)}
              >
                {tag}
              </Tag>
            ))}
          </div>

          {/* 下行：URL 友好串（仅同名多 tab 时展示） */}
          {showUrlHint && urlHint && (
            <Tooltip title={tab.url} mouseEnterDelay={0.4} placement="bottomLeft">
              <span className={styles['app-tab-item-url-hint']}>
                {urlHint}
              </span>
            </Tooltip>
          )}
        </div>

        {/* 状态图标 */}
        <div className={styles['app-tab-item-status']}>
          {tab.audible && (
            <Tooltip title={t('tabs.playing')}>
              <Volume2 size={ICON_SIZE.SMALL} className={styles['app-tab-item-status-primary']} />
            </Tooltip>
          )}
          {!tab.isCurrentWindow && (
            <Tooltip title={t('tabs.otherWindow')}>
              {/* 使用外链箭头图标表达「跳去另一个窗口」语义，避免与 favicon 兜底的 Global 图标混淆 */}
              <Pointer size={ICON_SIZE.SMALL} className={styles['app-tab-item-secondary-icon']} />
            </Tooltip>
          )}
        </div>

        {/* 行尾附加信息（如时间戳），放在状态图标和关闭按钮之间 */}
        {trailing}

        {/* 添加到常用站点——hover 时显示星标按钮，已添加则高亮常驻 */}
        <Tooltip title={isInQuickStart ? t('context.alreadyInQuickStart') : t('context.addToQuickStart')}>
          <Button
            type="text"
            size="small"
            icon={<Star size={ICON_SIZE.SMALL} fill={isInQuickStart ? 'currentColor' : 'none'} />}
            onClick={(e) => {
              e.stopPropagation();
              if (isInQuickStart) return;
              void addSite({
                id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                url: tab.url,
                title: tab.title,
                favIconUrl: tab.favIconUrl || undefined,
                order: speedDialSites.length,
                createdAt: Date.now(),
              });
            }}
            aria-label={t('context.addToQuickStart')}
            className={[
              styles['app-tab-item-action'],
              styles['app-tab-item-action--favorite'],
              isInQuickStart ? styles['is-active'] : 'app-hover-reveal',
            ].join(' ')}
          />
        </Tooltip>

        {/* 关闭按钮（hover/focus 时显示，由父节点 .app-hover-reveal-host 驱动） */}
        <Tooltip title={t('tabs.close')}>
          <Button
            type="text"
            size="small"
            danger
            icon={<X size={ICON_SIZE.SMALL} />}
            onClick={handleClose}
            aria-label={t('tabs.close')}
            className={`app-hover-reveal ${styles['app-tab-item-action']}`}
          />
        </Tooltip>
      </div>

      {/* 右键菜单——仅非多选模式下显示完整菜单 */}
      {contextMenu && (
        <TabContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          url={tab.url}
          title={tab.title}
          favIconUrl={tab.favIconUrl}
          tabId={tab.id}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
});
