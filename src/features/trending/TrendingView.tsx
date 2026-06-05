/**
 * 热榜聚合页面 —— 全网热点一站查看
 *
 * 功能：
 *   - 多分类导航（全部/综合/科技/娱乐/社区/新闻）
 *   - 热榜卡片网格，每卡片展示一个平台的 Top 榜单
 *   - 偷摸模式：一键伪装为邮件/文档/表格/代码页面
 *   - 手动刷新单个平台或全部刷新
 *   - 点击条目跳转到原始链接
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import {
  Alert,
  Button,
  Card,
  Segmented,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  RefreshCw,
  EyeOff,
  ExternalLink,
  Flame,
  Cpu,
  Gamepad2,
  Users,
  Newspaper,
  LayoutGrid,
  Mail,
  FileText,
  Table2,
  Code2,
  Bookmark,
  Copy,
  Clock,
} from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { cssVars } from "@/shared/utils/css-vars";
import { feedback } from "@/shared/ui/feedback";
import { useT } from "@/shared/i18n";
import { FeatureEmptyState } from "@/shared/ui/FeatureEmptyState";
import { createTab } from "@/chrome";
import { createBookmark } from "@/chrome/bookmarks";
import type {
  TrendingCategory,
  TrendingGroupMode,
  HotBoardData,
  StealthModeConfig,
} from "@/shared/types";
import {
  fetchMultipleBoards,
  forceRefreshBoard,
  getPlatformsByCategory,
  getPlatformColor,
  recordInterestSignal,
  getInterestSignals,
  applyInterestWeights,
} from "@/services/trending-service";
import type { InterestSignal } from "@/services/trending-service";
import styles from "./TrendingView.module.less";

const { Text, Title } = Typography;

interface CategoryOption {
  value: TrendingCategory;
  labelKey: string;
  icon: ReactNode;
}

const CATEGORIES: CategoryOption[] = [
  { value: "all", labelKey: "trending.catAll", icon: <LayoutGrid size={ICON_SIZE.DEFAULT} /> },
  {
    value: "comprehensive",
    labelKey: "trending.catComprehensive",
    icon: <Flame size={ICON_SIZE.DEFAULT} />,
  },
  { value: "tech", labelKey: "trending.catTech", icon: <Cpu size={ICON_SIZE.DEFAULT} /> },
  {
    value: "entertainment",
    labelKey: "trending.catEntertainment",
    icon: <Gamepad2 size={ICON_SIZE.DEFAULT} />,
  },
  {
    value: "community",
    labelKey: "trending.catCommunity",
    icon: <Users size={ICON_SIZE.DEFAULT} />,
  },
  { value: "news", labelKey: "trending.catNews", icon: <Newspaper size={ICON_SIZE.DEFAULT} /> },
];

const STEALTH_OPTIONS: Array<{
  value: StealthModeConfig["disguise"];
  labelKey: string;
  icon: ReactNode;
}> = [
  { value: "email", labelKey: "trending.stealthEmail", icon: <Mail size={ICON_SIZE.DEFAULT} /> },
  { value: "doc", labelKey: "trending.stealthDoc", icon: <FileText size={ICON_SIZE.DEFAULT} /> },
  {
    value: "spreadsheet",
    labelKey: "trending.stealthSpreadsheet",
    icon: <Table2 size={ICON_SIZE.DEFAULT} />,
  },
  { value: "code", labelKey: "trending.stealthCode", icon: <Code2 size={ICON_SIZE.DEFAULT} /> },
];

function cx(...classNames: Array<string | false | undefined>) {
  return classNames.filter(Boolean).join(" ");
}


function StealthDisguise({
  disguise,
  t,
}: {
  disguise: StealthModeConfig["disguise"];
  t: (key: string) => string;
}) {
  const content = useMemo(() => {
    switch (disguise) {
      case "email":
        return {
          title: t("收件箱"),
          items: [
            {
              from: t("产品经理"),
              subject: t("关于 Q2 季度 OKR 对齐会议的邀请"),
              time: t("10:32"),
            },
            { from: t("HR"), subject: t("本周五下午团建活动通知"), time: t("09:15") },
            { from: t("技术主管"), subject: t("Re: 新项目技术方案评审"), time: t("昨天") },
            { from: t("设计团队"), subject: t("设计稿已更新，请查阅 Figma"), time: t("昨天") },
            { from: t("运维"), subject: t("服务器维护通知 - 本周六凌晨"), time: t("周一") },
          ],
        };
      case "doc":
        return {
          title: t("项目周报 - 第 17 周"),
          items: [
            {
              from: t("一、本周工作进展"),
              subject: t("1.1 完成用户认证模块重构，测试覆盖率达到 92%"),
              time: "",
            },
            { from: "", subject: t("1.2 修复 3 个 P1 级线上问题，优化查询性能提升 40%"), time: "" },
            { from: t("二、下周计划"), subject: t("2.1 启动数据分析模块开发"), time: "" },
            { from: "", subject: t("2.2 完成技术方案评审与排期"), time: "" },
            { from: t("三、风险与依赖"), subject: t("3.1 第三方 API 响应延迟需跟进"), time: "" },
          ],
        };
      case "spreadsheet":
        return {
          title: t("Q2 季度预算表"),
          items: [
            { from: t("项目名称"), subject: t("预算金额（万元）"), time: t("实际支出") },
            { from: t("用户增长"), subject: "120.00", time: "98.50" },
            { from: t("内容运营"), subject: "85.00", time: "72.30" },
            { from: t("品牌推广"), subject: "200.00", time: "156.80" },
            { from: t("技术基建"), subject: "150.00", time: "134.20" },
          ],
        };
      case "code":
        return {
          title: t("main.ts"),
          items: [
            { from: " 1", subject: t("import { createApp } from 'vue';"), time: "" },
            { from: " 2", subject: t("import App from './App.vue';"), time: "" },
            { from: " 3", subject: t("import router from './router';"), time: "" },
            { from: " 4", subject: t("import { createPinia } from 'pinia';"), time: "" },
            { from: " 5", subject: "", time: "" },
            { from: " 6", subject: t("const app = createApp(App);"), time: "" },
            { from: " 7", subject: t("app.use(createPinia());"), time: "" },
            { from: " 8", subject: t("app.use(router);"), time: "" },
            { from: " 9", subject: t('app.mount("#app");'), time: "" },
          ],
        };
    }
  }, [disguise, t]);

  return (
    <div className={styles["trending-stealth-content"]}>
      <Card
        className={cx(
          styles["trending-surface-card"],
          styles["trending-disguise-card"],
          styles[`trending-disguise-card--${disguise}`],
        )}
        classNames={{ body: styles["trending-disguise-card__body"] }}
      >
        <Title level={4} className={styles["trending-disguise-title"]}>
          {content.title}
        </Title>
        <div className={styles["trending-disguise-list"]}>
          {content.items.map((item, index) => (
            <div
              key={`${disguise}-${index}`}
              className={cx(
                styles["trending-disguise-row"],
                index < content.items.length - 1 && "has-divider",
              )}
            >
              {item.from && <span className={styles["trending-disguise-from"]}>{item.from}</span>}
              <span className={styles["trending-disguise-subject"]}>{item.subject}</span>
              {item.time && <span className={styles["trending-disguise-time"]}>{item.time}</span>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <span
        className={cx(styles["trending-rank-badge"], styles["is-top"], styles[`is-rank-${rank}`])}
      >
        {rank}
      </span>
    );
  }

  return <span className={cx(styles["trending-rank-badge"], styles["is-plain"])}>{rank}</span>;
}

function TrendingListItem({
  item,
  rank,
  onSave,
  onReadLater,
}: {
  item: HotBoardData["items"][0];
  rank: number;
  onSave?: (item: HotBoardData["items"][0]) => void;
  onReadLater?: (item: HotBoardData["items"][0]) => void;
}) {
  const { t } = useT();
  return (
    <Tooltip title={item.title} placement="topLeft" mouseEnterDelay={0.6}>
      <div className={styles["trending-list-item"]}>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className={styles["trending-list-item__link"]}
          onClick={() => {
            void recordInterestSignal(item.url, "click");
          }}
        >
          <RankBadge rank={rank} />
          <span className={styles["trending-list-item__title"]}>{item.title}</span>
          {item.hotLabel ? (
            <span className={styles["trending-list-item__hot"]}>{item.hotLabel}</span>
          ) : (
            <span
              className={`${styles["trending-list-item__hot"]} ${styles["trending-list-item__hot--empty"]}`}
              aria-hidden="true"
            />
          )}
          <ExternalLink size={12} className={styles["trending-list-item__icon"]} />
        </a>
        <div className={styles["trending-list-item__actions"]}>
          {onSave && (
            <Tooltip title={t("加入书签")} mouseEnterDelay={0.4}>
              <Button
                type="text"
                size="small"
                icon={<Bookmark size={11} />}
                className={styles["trending-list-item__action-btn"]}
                onClick={(e) => {
                  e.stopPropagation();
                  onSave(item);
                }}
              />
            </Tooltip>
          )}
          {onReadLater && (
            <Tooltip title={t("稍后阅读")} mouseEnterDelay={0.4}>
              <Button
                type="text"
                size="small"
                icon={<Clock size={11} />}
                className={styles["trending-list-item__action-btn"]}
                onClick={(e) => {
                  e.stopPropagation();
                  onReadLater(item);
                }}
              />
            </Tooltip>
          )}
          <Tooltip title={t("复制链接")} mouseEnterDelay={0.4}>
            <Button
              type="text"
              size="small"
              icon={<Copy size={11} />}
              className={styles["trending-list-item__action-btn"]}
              onClick={(e) => {
                e.stopPropagation();
                void navigator.clipboard.writeText(item.url).then(() => {
                  void feedback.success(t("链接已复制"));
                });
              }}
            />
          </Tooltip>
        </div>
      </div>
    </Tooltip>
  );
}

function HotBoardSkeletonCard({
  platformId,
  platformName,
  platformSubtitle,
  onRefresh,
}: {
  platformId: string;
  platformName: string;
  platformSubtitle: string;
  onRefresh: (id: string) => Promise<boolean>;
}) {
  const { t } = useT();
  const platformStyle = cssVars({ "--trending-platform-color": getPlatformColor(platformId) });
  const [refreshing, setRefreshing] = useState(false);
  const [errored, setErrored] = useState(false);

  const handleRefresh = useCallback(async () => {
    setErrored(false);
    setRefreshing(true);
    const result = await onRefresh(platformId);
    setRefreshing(false);
    if (!result) setErrored(true);
  }, [platformId, onRefresh]);

  return (
    <Card
      className={`${styles["trending-surface-card"]} ${styles["trending-board-card"]}`}
      classNames={{ body: styles["trending-board-card__body"] }}
    >
      <div className={styles["trending-board-card__header"]}>
        <div className={styles["trending-board-card__meta"]} style={platformStyle}>
          <span className={styles["trending-board-card__dot"]} />
          <span className={styles["trending-board-card__name"]}>{platformName}</span>
          {platformSubtitle && (
            <Tag className={styles["trending-board-card__tag"]}>{platformSubtitle}</Tag>
          )}
        </div>
        <Tooltip title={t("刷新")}>
          <Button
            type="text"
            size="small"
            icon={
              <RefreshCw
                size={ICON_SIZE.SMALL}
                className={cx(styles["trending-refresh-icon"], refreshing && "is-spinning")}
              />
            }
            onClick={() => {
              void handleRefresh();
            }}
            disabled={refreshing}
          />
        </Tooltip>
      </div>

      <div className={styles["trending-board-card__placeholder"]}>
        {refreshing ? (
          <>
            <Spin size="small" />
            <Text type="secondary" className={styles["trending-board-card__placeholder-text"]}>
              {t("正在加载热榜…")}
            </Text>
          </>
        ) : errored ? (
          <>
            <Text type="danger" className={styles["trending-board-card__placeholder-text"]}>
              {t("暂无数据")}
            </Text>
            <Button
              type="link"
              size="small"
              onClick={() => {
                void handleRefresh();
              }}
              className={styles["trending-board-card__retry-btn"]}
            >
              {t("刷新")}
            </Button>
          </>
        ) : (
          <>
            <Spin size="small" />
            <Text type="secondary" className={styles["trending-board-card__placeholder-text"]}>
              {t("正在加载热榜…")}
            </Text>
          </>
        )}
      </div>
    </Card>
  );
}

function HotBoardCard({
  board,
  onRefresh,
  signals,
  onSaveItem,
  onReadLaterItem,
}: {
  board: HotBoardData;
  onRefresh: (id: string) => Promise<boolean>;
  signals: Record<string, InterestSignal>;
  onSaveItem: (item: HotBoardData["items"][0]) => void;
  onReadLaterItem: (item: HotBoardData["items"][0]) => void;
}) {
  const { t } = useT();
  const [refreshing, setRefreshing] = useState(false);
  const platformStyle = cssVars({ "--trending-platform-color": getPlatformColor(board.id) });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await onRefresh(board.id);
    setRefreshing(false);
  }, [board.id, onRefresh]);

  // 根据兴趣信号重排条目
  const sortedItems = useMemo(
    () => applyInterestWeights(board.items, signals),
    [board.items, signals],
  );

  return (
    <Card
      className={`${styles["trending-surface-card"]} ${styles["trending-board-card"]}`}
      classNames={{ body: styles["trending-board-card__body"] }}
    >
      <div className={styles["trending-board-card__header"]}>
        <div className={styles["trending-board-card__meta"]} style={platformStyle}>
          <span className={styles["trending-board-card__dot"]} />
          <span className={styles["trending-board-card__name"]}>{board.name}</span>
          {board.subtitle && (
            <Tag className={styles["trending-board-card__tag"]}>{board.subtitle}</Tag>
          )}
        </div>
        <Tooltip title={t("刷新")}>
          <Button
            type="text"
            size="small"
            icon={
              <RefreshCw
                size={ICON_SIZE.SMALL}
                className={cx(styles["trending-refresh-icon"], refreshing && "is-spinning")}
              />
            }
            onClick={() => {
              void handleRefresh();
            }}
            disabled={refreshing}
          />
        </Tooltip>
      </div>

      <div className={styles["trending-board-card__list"]}>
        {sortedItems.length === 0 ? (
          <div className={styles["trending-board-card__empty"]}>
            <Text type="secondary" className={styles["trending-board-card__placeholder-text"]}>
              {t("暂无数据")}
            </Text>
          </div>
        ) : (
          sortedItems.map((item, index) => (
            <TrendingListItem
              key={item.id || index}
              item={item}
              rank={index + 1}
              onSave={onSaveItem}
              onReadLater={onReadLaterItem}
            />
          ))
        )}
      </div>

      {board.updateTime && (
        <div className={styles["trending-board-card__footer"]}>
          <Text type="secondary" className={styles["trending-board-card__time"]}>
            {new Date(board.updateTime).toLocaleTimeString()}
          </Text>
        </div>
      )}
    </Card>
  );
}

export function TrendingView() {
  const { t } = useT();
  const [category, setCategory] = useState<TrendingCategory>("all");
  const [groupMode, setGroupMode] = useState<TrendingGroupMode>("default");
  const [stealthMode, setStealthMode] = useState<StealthModeConfig>({
    enabled: false,
    disguise: "email",
  });
  const [boards, setBoards] = useState<Record<string, HotBoardData>>({});
  const [loading, setLoading] = useState(true);
  const [allFailed, setAllFailed] = useState(false);
  const [signals, setSignals] = useState<Record<string, InterestSignal>>({});

  // 加载兴趣信号
  useEffect(() => {
    void getInterestSignals().then(setSignals);
  }, []);

  /** 保存条目到书签 */
  const handleSaveItem = useCallback(
    async (item: HotBoardData["items"][0]) => {
      await recordInterestSignal(item.url, "save");
      setSignals(await getInterestSignals());
      try {
        await createBookmark({ title: item.title, url: item.url });
        void feedback.success(t("已加入书签"));
      } catch {
        void feedback.error(t("书签添加失败"));
      }
    },
    [t],
  );

  /** 加入稍后阅读（新建标签页后台打开） */
  const handleReadLaterItem = useCallback(
    async (item: HotBoardData["items"][0]) => {
      await recordInterestSignal(item.url, "save");
      setSignals(await getInterestSignals());
      try {
        await createTab({ url: item.url, active: false });
        void feedback.success(t("已在后台打开"));
      } catch {
        window.open(item.url, "_blank", "noopener,noreferrer");
      }
    },
    [t],
  );

  const activePlatforms = useMemo(() => getPlatformsByCategory(category), [category]);
  const hasBoardData = Object.keys(boards).length > 0;

  const loadBoards = useCallback(async (platformIds: string[]) => {
    setLoading(true);
    setAllFailed(false);
    try {
      const data = await fetchMultipleBoards(platformIds);
      setBoards((prev) => ({ ...prev, ...data }));
      if (Object.keys(data).length === 0 && platformIds.length > 0) {
        setAllFailed(true);
      }
    } catch {
      setAllFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ids = activePlatforms.map((platform) => platform.id);
    void loadBoards(ids);
  }, [activePlatforms, loadBoards]);

  const handleRefreshBoard = useCallback(async (platformId: string): Promise<boolean> => {
    const data = await forceRefreshBoard(platformId);
    if (data) {
      setBoards((prev) => ({ ...prev, [platformId]: data }));
      return true;
    }
    return false;
  }, []);

  const handleRefreshAll = useCallback(() => {
    const ids = activePlatforms.map((platform) => platform.id);
    void loadBoards(ids);
  }, [activePlatforms, loadBoards]);

  const toggleStealthMode = useCallback(() => {
    setStealthMode((prev) => ({ ...prev, enabled: !prev.enabled }));
  }, []);

  const categoryOptions = useMemo(
    () =>
      CATEGORIES.map((item) => ({
        value: item.value,
        label: (
          <span className={styles["trending-category-option"]}>
            {item.icon}
            <span>{t(item.labelKey)}</span>
          </span>
        ),
      })),
    [t],
  );

  const groupModeOptions = useMemo(
    () => [
      { value: "default" as TrendingGroupMode, label: t("默认") },
      { value: "compact" as TrendingGroupMode, label: t("紧凑") },
    ],
    [t],
  );

  if (stealthMode.enabled) {
    return (
      <section className={`${styles["trending-page"]} ${styles["trending-page--stealth"]}`}>
        <div className={styles["trending-stealth-toolbar"]}>
          <Space size={8}>
            {STEALTH_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="text"
                size="small"
                icon={option.icon}
                aria-pressed={stealthMode.disguise === option.value}
                onClick={() => setStealthMode((prev) => ({ ...prev, disguise: option.value }))}
                className={cx(
                  styles["trending-stealth-toolbar__button"],
                  stealthMode.disguise === option.value && "is-active",
                )}
              />
            ))}
            <Button
              type="text"
              size="small"
              icon={<EyeOff size={ICON_SIZE.SMALL} />}
              onClick={toggleStealthMode}
              className={cx(
                styles["trending-stealth-toolbar__button"],
                styles["trending-stealth-toolbar__button--exit"],
              )}
            />
          </Space>
        </div>
        <StealthDisguise disguise={stealthMode.disguise} t={t} />
      </section>
    );
  }

  return (
    <section className={styles["trending-page"]}>
      <Card
        className={`${styles["trending-surface-card"]} ${styles["trending-toolbar-card"]}`}
        classNames={{ body: styles["trending-toolbar-card__body"] }}
      >
        <div className={styles["trending-toolbar-card__stack"]}>
          <div className={styles["trending-toolbar-card__topline"]}>
            <div className={styles["trending-toolbar-card__title-group"]}>
              <span className={styles["trending-toolbar-card__icon"]}>
                <Flame size={ICON_SIZE.LARGE} />
              </span>
              <Title level={4} className={styles["trending-toolbar-card__title"]}>
                {t("全网热榜")}
              </Title>
            </div>
            <Space size={4} className={styles["trending-toolbar-card__actions"]}>
              <Tooltip title={t("全部刷新")}>
                <Button
                  type="text"
                  size="small"
                  icon={
                    <RefreshCw
                      size={ICON_SIZE.SMALL}
                      className={cx(styles["trending-refresh-icon"], loading && "is-spinning")}
                    />
                  }
                  onClick={handleRefreshAll}
                  disabled={loading}
                />
              </Tooltip>
              <Tooltip title={t("偷摸模式")}>
                <Button
                  type="text"
                  size="small"
                  icon={<EyeOff size={ICON_SIZE.SMALL} />}
                  onClick={toggleStealthMode}
                />
              </Tooltip>
            </Space>
          </div>

          <div className={styles["trending-toolbar-card__controls"]}>
            <Segmented<TrendingCategory>
              value={category}
              onChange={setCategory}
              options={categoryOptions}
              size="small"
              className={`${styles["trending-toolbar-card__segment"]} ${styles["trending-toolbar-card__segment--categories"]}`}
            />
            <Segmented<TrendingGroupMode>
              size="small"
              value={groupMode}
              onChange={setGroupMode}
              options={groupModeOptions}
              className={`${styles["trending-toolbar-card__segment"]} ${styles["trending-toolbar-card__segment--group"]}`}
            />
          </div>
        </div>
      </Card>

      {allFailed && (
        <Alert
          type="warning"
          showIcon
          title={t("热榜数据源暂时不可用，请稍后重试")}
          action={
            <Button size="small" onClick={handleRefreshAll} loading={loading}>
              {t("全部刷新")}
            </Button>
          }
          className={styles["trending-alert"]}
        />
      )}

      {loading && !hasBoardData ? (
        <div className={styles["trending-loading-state"]}>
          <div className={styles["trending-loading-state__inner"]}>
            <Spin />
            <Text type="secondary">{t("正在加载热榜…")}</Text>
          </div>
        </div>
      ) : activePlatforms.length === 0 ? (
        <FeatureEmptyState
          title={t("trending.noPlatforms")}
          icon={<Newspaper size={ICON_SIZE.HERO} />}
          hints={[t("trending.noPlatformsHint1"), t("trending.noPlatformsHint2"), t("trending.noPlatformsHint3")]}
          actions={[{ text: t("trending.switchToAll"), onClick: () => setCategory("all"), type: "primary" }]}
        />
      ) : (
        <div
          className={cx(styles["trending-grid"], groupMode === "compact" && styles["is-compact"])}
        >
          {activePlatforms.map((platform) => {
            const board = boards[platform.id];
            if (!board) {
              return (
                <HotBoardSkeletonCard
                  key={platform.id}
                  platformId={platform.id}
                  platformName={platform.name}
                  platformSubtitle={platform.subtitle}
                  onRefresh={handleRefreshBoard}
                />
              );
            }

            return (
              <HotBoardCard
                key={platform.id}
                board={board}
                onRefresh={handleRefreshBoard}
                signals={signals}
                onSaveItem={(item) => {
                  void handleSaveItem(item);
                }}
                onReadLaterItem={(item) => {
                  void handleReadLaterItem(item);
                }}
              />
            );
          })}
        </div>
      )}

      {loading && hasBoardData && (
        <div className={styles["trending-loading-more"]}>
          <Spin size="small" />
        </div>
      )}
    </section>
  );
}
