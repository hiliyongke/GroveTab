/**
 * 热榜聚合页面 —— 全网热点一站查看
 *
 * 功能：
 *   - 热榜卡片网格，每卡片展示一个平台的 Top 榜单
 *   - 手动刷新单个平台或全部刷新
 *   - 点击条目跳转到原始链接
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Alert,
  Button,
  Card,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  RefreshCw,
  ExternalLink,
  Flame,
  Clock,
} from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { cssVars } from "@/shared/utils/css-vars";
import { feedback } from "@/shared/ui/feedback";
import { useT } from "@/shared/i18n";
import { FeatureEmptyState } from "@/shared/ui/FeatureEmptyState";
import { createTab } from "@/chrome";
import { isSafeExternalUrl } from "@/shared/utils/url-safety";
import type {
  HotBoardData,
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

function cx(...classNames: Array<string | false | undefined>) {
  return classNames.filter(Boolean).join(" ");
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
  onReadLater,
}: {
  item: HotBoardData["items"][0];
  rank: number;
  onReadLater?: (item: HotBoardData["items"][0]) => void;
}) {
  const { t } = useT();
  return (
    <Tooltip title={item.title} placement="topLeft" mouseEnterDelay={0.6}>
      <div className={styles["trending-list-item"]}>
        <a
          href={isSafeExternalUrl(item.url) ? item.url : "#"}
          target="_blank"
          rel="noopener noreferrer"
          className={styles["trending-list-item__link"]}
          onClick={(e) => {
            if (!isSafeExternalUrl(item.url)) {
              e.preventDefault();
              return;
            }
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
          {onReadLater && (
            <Tooltip title={t("稍后阅读")} mouseEnterDelay={0.4}>
              <Button
                type="text"
                icon={<Clock size={11} />}
                className={styles["trending-list-item__action-btn"]}
                onClick={(e) => {
                  e.stopPropagation();
                  onReadLater(item);
                }}
              />
            </Tooltip>
          )}
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
            <Spin />
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
            <Spin />
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
  onReadLaterItem,
}: {
  board: HotBoardData;
  onRefresh: (id: string) => Promise<boolean>;
  signals: Record<string, InterestSignal>;
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
  const [boards, setBoards] = useState<Record<string, HotBoardData>>({});
  const [loading, setLoading] = useState(true);
  const [allFailed, setAllFailed] = useState(false);
  const [signals, setSignals] = useState<Record<string, InterestSignal>>({});

  // 加载兴趣信号
  useEffect(() => {
    void getInterestSignals().then(setSignals);
  }, []);

  /** 加入稍后阅读（新建标签页后台打开） */
  const handleReadLaterItem = useCallback(
    async (item: HotBoardData["items"][0]) => {
      if (!isSafeExternalUrl(item.url)) {
        void feedback.warning(t("不安全的链接，已拦截"));
        return;
      }
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

  const activePlatforms = useMemo(() => getPlatformsByCategory("all"), []);
  const hasBoardData = Object.keys(boards).length > 0;

  const loadBoards = useCallback(async (platformIds: string[]) => {
    setLoading(true);
    setAllFailed(false);
    try {
      const data = await fetchMultipleBoards(platformIds, 2, (platformId, board) => {
        // 渐进加载：每个平台请求完成立即渲染到 UI
        setBoards((prev) => ({ ...prev, [platformId]: board }));
      });
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
                <Flame size={ICON_SIZE.MEDIUM} />
              </span>
              <Title level={4} className={styles["trending-toolbar-card__title"]}>
                {t("全网热榜")}
              </Title>
            </div>
            <Space size={4} className={styles["trending-toolbar-card__actions"]}>
              <Tooltip title={t("全部刷新")}>
                <Button
                  type="text"
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
            </Space>
          </div>
        </div>
      </Card>

      {allFailed && (
        <Alert
          type="warning"
          showIcon
          title={t("热榜数据源暂时不可用，请稍后重试")}
          action={
            <Button onClick={handleRefreshAll} loading={loading}>
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
          title={t("当前分类暂无可用平台")}
          icon={<Flame size={ICON_SIZE.HERO} />}
          hints={[t("部分平台仅支持综合分类"), t("尝试切换到其它分类查看"), t("数据源可能正在维护")]
          }
          actions={[{ text: t("刷新全部"), onClick: handleRefreshAll, type: "primary" }]}
        />
      ) : (
        <div className={styles["trending-grid"]}>
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
          <Spin />
        </div>
      )}
    </section>
  );
}
