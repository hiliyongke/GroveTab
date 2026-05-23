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
import { useTabsStore, useSettingsStore } from '@/store';
import { useT } from '@/shared/i18n';
import { groupTabsByDomain } from '@/shared/utils/domain';
import { useAccent } from '@/shared/hooks/use-accent';
import { findAmbiguousTitleIds } from '@/shared/utils/url-display';
import { cssVars } from '@/shared/utils/css-vars';
import { TabItem } from './TabItem';
import type { LiveTab } from '@/shared/types';
import styles from './GridView.module.less';

/**
 * 网格视图主组件：每个域名一张大卡片
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
 *     展示该域名下的完整列表
 *
 * @returns 网格视图 JSX 元素
 */
export function GridView() {
  const tabs = useTabsStore((s) => s.tabs);
  const jumpToTab = useTabsStore((s) => s.jumpToTab);
  const closeSingleTab = useTabsStore((s) => s.closeSingleTab);
  /**
   * 展开触发方式（点击 / 悬停）。默认 click——保持「需要确认动作」的稳重交互；
   * 切到 hover 后，鼠标移到多 tab 卡片上立即看到列表，移开自动收起，更适合
   * 喜欢「快速预览」的用户。
   */
  const expandTrigger = useSettingsStore(
    (s) => s.settings.gridExpandTrigger ?? 'click',
  );
  const { t } = useT();

  const groups = useMemo(() => groupTabsByDomain(tabs), [tabs]);

  /** 当前打开 Popover 的域名（null 代表全部关闭）——同时至多一个浮层 */
  const [activeDomain, setActiveDomain] = useState<string | null>(null);

  if (groups.length === 0) return null;

  /**
   * Popover 内点击「跳转」：跳完顺手关闭浮层
   *
   * @param tabId - 标签 ID
   * @param windowId - 窗口 ID
   * @returns 无返回值
   */
  const handleJumpFromPopover = (tabId: number, windowId: number) => {
    void jumpToTab(tabId, windowId);
    setActiveDomain(null);
  };

  return (
    <div className={styles['app-grid-view']}>
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
          expandTrigger={expandTrigger}
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
  /** 展开触发方式：'click' 点击 / 'hover' 悬停 */
  expandTrigger: 'click' | 'hover';
}

/**
 * 单张域名卡片
 * @param root0
 * @param root0.domain - 域名
 * @param root0.colorKey - 颜色键
 * @param root0.tabs - 标签页列表
 * @param root0.onJump - 跳转回调
 * @param root0.open - 是否展开
 * @param root0.onOpenChange - 展开变化回调
 * @param root0.onJumpFromPopover - 从弹出框跳转回调
 * @param root0.onCloseTab - 关闭标签页回调
 * @param root0.countLabel - 计数标签
 * @param root0.expandTrigger - 展开触发方式
 * @returns {JSX.Element} 卡片元素
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
  expandTrigger,
}: GridCardProps) {
  const [faviconError, setFaviconError] = useState(false);
  const { token } = theme.useToken();
  const hasAudible = tabs.some((tab) => tab.audible);
  const first = tabs[0];
  const isMulti = tabs.length > 1;
  /** 从 favicon 提取主色（失败自动回退到 colorKey 哈希色）——与常用站点算法一致 */
  const accent = useAccent(first?.favIconUrl, colorKey);
  const color = accent.bar;

  /**
   * 点击卡片
   *
   * 处理卡片点击逻辑：
   *   - 单 tab：直接跳转
   *   - 多 tab + click 模式：切换 Popover
   *   - 多 tab + hover 模式：保留点击=跳转到首个 tab 的快捷路径
   *     （hover 已能展开浮层，再让点击切换会语义打架）
   *
   * @returns 无返回值
   */
  const handleCardClick = () => {
    if (isMulti) {
      if (expandTrigger === 'click') {
        onOpenChange(!open);
      } else if (first) {
        onJump(first.id, first.windowId);
      }
      return;
    }
    if (first) onJump(first.id, first.windowId);
  };

  const cardNode = (
    <Card
      onClick={handleCardClick}
      className={`${styles['app-card-interactive']} ${styles['app-grid-card']}`}
      classNames={{ body: styles['app-grid-card__body'] }}
      style={{
        borderRadius: token.borderRadiusLG,
        ...cssVars({
          '--app-hover-border': token.colorPrimaryBorder,
          '--app-grid-card-accent': color,
        }),
      }}
    >
      {/* 缩略图区 —— 16:10 宽高比 */}
      <div className={styles["app-grid-card-preview"]}>
        {first?.favIconUrl && !faviconError ? (
          <img
            src={first.favIconUrl}
            alt=""
            className={styles["app-grid-card-favicon"]}
            onError={() => setFaviconError(true)}
          />
        ) : (
          <span className={styles["app-grid-card-fallback"]}>
            {domain.charAt(0).toUpperCase()}
          </span>
        )}

        {/* 多 tab 角标：数字，右上角 */}
        {isMulti && (
          <span className={styles["app-grid-card-count"]}>
            {tabs.length}
          </span>
        )}
      </div>

      {/* 底部信息区 */}
      <div className={styles["app-grid-card-content"]}>
        <div className={styles["app-grid-card-meta"]}>
          <span className={styles["app-grid-card-domain"]}>
            {domain}
          </span>
          {hasAudible && (
            <Volume2 size={ICON_SIZE.SMALL} className={styles["app-grid-card-audible"]} />
          )}
        </div>
        <span className={styles["app-grid-card-copy"]}>
          {countLabel}
        </span>
      </div>
    </Card>
  );

  // 单 tab 卡片：不需要 Popover 包裹，少一层节点
  if (!isMulti) return cardNode;

  /**
   * 计算 Popover 鼠标延迟配置
   *
   * hover 模式下加 100ms 进入延迟，避免鼠标穿过卡片瞬间触发；
   * 离开延迟 150ms，让用户能从卡片移到浮层而不会先关掉。
   *
   * @returns 延迟配置对象，hover 模式下包含 mouseEnterDelay 和 mouseLeaveDelay
   */
  const popoverMouseDelay =
    expandTrigger === 'hover' ? { mouseEnterDelay: 0.1, mouseLeaveDelay: 0.15 } : {};

  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      trigger={expandTrigger}
      {...popoverMouseDelay}
      placement="bottom"
      arrow
      destroyOnHidden
      classNames={{ container: 'app-grid-popover-container' }}
      overlayClassName={styles["app-grid-popover-overlay"]}
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
 * @param root0
 * @param root0.domain
 * @param root0.tabs
 * @param root0.accentColor
 * @param root0.faviconSrc
 * @param root0.onJump
 * @param root0.onCloseTab
 * @param root0.onClose
 * @returns {JSX.Element} 域名多 tab 快速预览面板 JSX 元素
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
   * 关闭标签并处理浮层状态
   *
   * 关闭某个 tab 后如果已没东西可看就收起浮层；
   * 由于 tabs 由父层实时下发，这里拿到的长度即为当前快照值。
   *
   * @param id - 要关闭的标签 ID
   * @returns 无返回值
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
    <div className={styles["app-grid-popover"]} style={popoverStyle}>
      {/* Header —— 色条 + favicon + 域名 + 计数 + 关闭 */}
      <div className={styles["app-grid-popover__header"]}>
        {/* 左侧身份色条 */}
        <span aria-hidden className={styles["app-grid-popover__accent"]} />
        {/* favicon */}
        {hasFavicon && !faviconFailed ? (
          <img
            src={faviconSrc}
            alt=""
            className={styles["app-grid-popover__favicon"]}
            onError={() => setFaviconFailed(true)}
          />
        ) : (
          <span aria-hidden className={styles["app-grid-popover__fallback"]}>
            {domain.charAt(0).toUpperCase()}
          </span>
        )}
        {/* 域名 —— 允许省略 */}
        <span title={domain} className={styles["app-grid-popover__title"]}>
          {domain}
        </span>
        {/* 计数 —— secondary tone，tabular */}
        <span className={styles["app-grid-popover__count"]}>
          {t('header.tabCount', { count: tabs.length })}
        </span>
        {/* 关闭按钮 —— antd Button（键盘可达 + ant 原生样式） */}
        <Button
          type="text"
          size="small"
          aria-label="Close"
          onClick={onClose}
          icon={<X size={ICON_SIZE.MEDIUM} />}
          className={styles["app-grid-popover__close"]}
        />
      </div>

      {/* 列表区 */}
      <div className={styles["app-grid-popover__list"]}>
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
