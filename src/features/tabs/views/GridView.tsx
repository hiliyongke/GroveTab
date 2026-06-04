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

import { useMemo, useState } from "react";
import { Button, Card, Flex, Popover, theme, Typography, Empty } from "antd";
import { Volume2, X } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useTabsStore, useSettingsStore } from "@/store";
import { useT } from "@/shared/i18n";
import { groupTabsByDomain } from "@/shared/utils/domain";
import { useAccent } from "@/shared/hooks/use-accent";
import { findAmbiguousTitleIds } from "@/shared/utils/url-display";
import { cssVars } from "@/shared/utils/css-vars";
import { TabItem } from "../components/TabItem";
import type { LiveTab } from "@/shared/types";
import styles from "../styles/views.module.less";

interface GridViewProps {
  filterQuery?: string;
}

/**
 * 网格视图主组件：每个域名一张大卡片
 */
export function GridView({ filterQuery = "" }: GridViewProps) {
  const tabs = useTabsStore((s) => s.tabs);
  const jumpToTab = useTabsStore((s) => s.jumpToTab);
  const closeSingleTab = useTabsStore((s) => s.closeSingleTab);
  /**
   * 展开触发方式（点击 / 悬停）。默认 click——保持「需要确认动作」的稳重交互；
   * 切到 hover 后，鼠标移到多 tab 卡片上立即看到列表，移开自动收起，更适合
   * 喜欢「快速预览」的用户。
   */
  const expandTrigger = useSettingsStore((s) => s.settings.gridExpandTrigger ?? "click");
  /**
   * 网格卡片尺寸档位（v1.4 新增）。
   *   - 'sm'   ：紧凑（标签页多时使用，单卡 ~160px）
   *   - 'md'   ：默认（单卡 ~200px，与 v1.3 行为一致）
   *   - 'lg'   ：宽松（标签页少时使用，单卡 ~240px）
   *   - 'auto' ：根据标签页数量自动适配（≤10 用 lg，11-30 用 md，>30 用 sm）
   */
  const cardSize = useSettingsStore((s) => s.settings.gridCardSize ?? "md");
  const { t } = useT();

  const allGroups = useMemo(() => groupTabsByDomain(tabs), [tabs]);

  // 搜索过滤：匹配域名 或 组内任意 tab 匹配标题/URL
  const groups = useMemo(() => {
    const query = filterQuery.trim().toLowerCase();
    if (!query) return allGroups;
    return allGroups.filter((group) => {
      if (group.domain.toLowerCase().includes(query)) return true;
      return group.tabs.some(
        (tab) => tab.title.toLowerCase().includes(query) || tab.url.toLowerCase().includes(query),
      );
    });
  }, [allGroups, filterQuery]);

  /**
   * 根据卡片尺寸档位计算实际的卡片最小宽度。
   *   - sm / md / lg：固定档位
   *   - auto：根据标签页数量自动适配
   */
  const cardMinWidth = useMemo(() => {
    // 自动适配逻辑：根据标签页总数决定卡片大小
    if (cardSize === "auto") {
      const totalTabs = tabs.length;
      if (totalTabs <= 10) return "240px"; // 标签页少时使用大卡片
      if (totalTabs <= 30) return "200px"; // 中等数量使用默认卡片
      return "160px"; // 标签页多时使用紧凑卡片
    }

    // 固定档位映射
    const SIZE_MAP = { sm: "160px", md: "200px", lg: "240px" } as const;
    return SIZE_MAP[cardSize] ?? SIZE_MAP.md;
  }, [cardSize, tabs.length]);

  /** 顶层 wrapper 上注入 --grid-card-min-width CSS 变量 */
  const wrapperStyle = useMemo(
    () => cssVars({ "--grid-card-min-width": cardMinWidth }),
    [cardMinWidth],
  );

  /** 当前打开 Popover 的域名（null 代表全部关闭）——同时至多一个浮层 */
  const [activeDomain, setActiveDomain] = useState<string | null>(null);

  // 空状态：原始 tabs 为空时不渲染；过滤后为空时显示 Empty
  const allTabsEmpty = tabs.length === 0;
  if (allTabsEmpty) return null;

  if (groups.length === 0) {
    return <Empty description={t("search.noDomainResults")} />;
  }

  /** Popover 内点击「跳转」：跳完顺手关闭浮层 */
  const handleJumpFromPopover = (tabId: number, windowId: number) => {
    void jumpToTab(tabId, windowId);
    setActiveDomain(null);
  };

  return (
    <div className={styles["app-grid-view"]} style={wrapperStyle}>
      {groups.map((group) => (
        <div key={group.domain} className={styles["app-grid-view__cell"]}>
          <GridCard
            domain={group.domain}
            colorKey={group.colorKey}
            tabs={group.tabs}
            onJump={(id, wid) => {
              void jumpToTab(id, wid);
            }}
            open={activeDomain === group.domain}
            onOpenChange={(next) => setActiveDomain(next ? group.domain : null)}
            onJumpFromPopover={handleJumpFromPopover}
            onCloseTab={(id) => {
              void closeSingleTab(id);
            }}
            countLabel={t("{count} 个标签页", { count: group.tabs.length })}
            expandTrigger={expandTrigger}
          />
        </div>
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
  expandTrigger: "click" | "hover";
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
   * 点击卡片：
   *   - 单 tab：直接跳转
   *   - 多 tab + click 模式：切换 Popover
   *   - 多 tab + hover 模式：保留点击=跳转到首个 tab 的快捷路径
   *     （hover 已能展开浮层，再让点击切换会语义打架）
   */
  const handleCardClick = () => {
    if (isMulti) {
      if (expandTrigger === "click") {
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
      className={`app-card-interactive ${styles["app-grid-card"]}`}
      classNames={{ body: styles["app-grid-card__body"] }}
      data-border-radius={token.borderRadiusLG}
      data-hover-border={token.colorPrimaryBorder}
      data-card-accent={color}
    >
      {/* 缩略图区 —— 16:10 宽高比 */}
      <Flex align="center" justify="center" className={styles["app-grid-card-preview"]}>
        {first?.favIconUrl && !faviconError ? (
          <img
            src={first.favIconUrl}
            alt=""
            width={36}
            height={36}
            className={styles["app-grid-card-favicon"]}
            onError={() => setFaviconError(true)}
          />
        ) : (
          <Typography.Text className={styles["app-grid-card-fallback"]}>
            {domain.charAt(0).toUpperCase()}
          </Typography.Text>
        )}

        {/* 多 tab 角标：数字，右上角 */}
        {isMulti && (
          <Typography.Text className={styles["app-grid-card-count"]}>{tabs.length}</Typography.Text>
        )}
      </Flex>

      {/* 底部信息区 */}
      <Flex vertical gap={2} className={styles["app-grid-card-content"]}>
        <Flex align="center" gap="small" className={styles["app-grid-card-meta"]}>
          <Typography.Text className={styles["app-grid-card-domain"]}>{domain}</Typography.Text>
          {hasAudible && (
            <Volume2 size={ICON_SIZE.SMALL} className={styles["app-grid-card-audible"]} />
          )}
        </Flex>
        <Typography.Text className={styles["app-grid-card-copy"]}>{countLabel}</Typography.Text>
      </Flex>
    </Card>
  );

  // 单 tab 卡片：不需要 Popover 包裹，少一层节点
  if (!isMulti) return cardNode;

  /**
   * hover 模式下加 100ms 进入延迟，避免鼠标穿过卡片瞬间触发；
   * 离开延迟 150ms，让用户能从卡片移到浮层而不会先关掉。
   */
  const popoverMouseDelay =
    expandTrigger === "hover" ? { mouseEnterDelay: 0.1, mouseLeaveDelay: 0.15 } : {};

  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      trigger={expandTrigger}
      {...popoverMouseDelay}
      placement="bottom"
      arrow
      destroyOnHidden
      classNames={{ container: "app-grid-popover-container" }}
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

  const hasFavicon = typeof faviconSrc === "string" && faviconSrc.length > 0;
  const popoverStyle: React.CSSProperties = cssVars({
    "--app-grid-popover-accent": accentColor,
  });

  return (
    <Flex vertical className={styles["app-grid-popover"]} style={popoverStyle}>
      {/* Header —— 色条 + favicon + 域名 + 计数 + 关闭 */}
      <Flex align="center" gap={8} className={styles["app-grid-popover__header"]}>
        {/* 左侧身份色条 */}
        <Typography.Text aria-hidden className={styles["app-grid-popover__accent"]} />
        {/* favicon */}
        {hasFavicon && !faviconFailed ? (
          <img
            src={faviconSrc}
            alt=""
            width={16}
            height={16}
            className={styles["app-grid-popover__favicon"]}
            onError={() => setFaviconFailed(true)}
          />
        ) : (
          <Typography.Text aria-hidden className={styles["app-grid-popover__fallback"]}>
            {domain.charAt(0).toUpperCase()}
          </Typography.Text>
        )}
        {/* 域名 —— 允许省略 */}
        <Typography.Text title={domain} className={styles["app-grid-popover__title"]}>
          {domain}
        </Typography.Text>
        {/* 计数 —— secondary tone，tabular */}
        <Typography.Text className={styles["app-grid-popover__count"]}>
          {t("{count} 个标签页", { count: tabs.length })}
        </Typography.Text>
        {/* 关闭按钮 —— antd Button（键盘可达 + ant 原生样式） */}
        <Button
          type="text"
          size="small"
          aria-label="Close"
          onClick={onClose}
          icon={<X size={ICON_SIZE.MEDIUM} />}
          className={styles["app-grid-popover__close"]}
        />
      </Flex>

      {/* 列表区 */}
      <Flex vertical gap={2} className={styles["app-grid-popover__list"]}>
        {tabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            onJump={onJump}
            onClose={handleCloseTab}
            showUrlHint={ambiguousIds.has(tab.id)}
          />
        ))}
      </Flex>
    </Flex>
  );
}
