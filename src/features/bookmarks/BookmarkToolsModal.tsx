/**
 * BookmarkToolsModal —— 书签工具箱（v2 视觉重构）
 *
 * 设计目标：
 *   - 像「Mac 系统设置」一样：左侧分类导航 + 右侧详情；进入即看「总览」
 *   - 每个能力都按「① 提示 → ② 操作 → ③ 结果」三段式呈现，节奏一致
 *   - 列表项展示 favicon + 标题 + 域名 / 状态，告别"光秃秃文字"
 *
 * 能力清单（v2）：
 *   1. 总览（Overview）——书签健康一览
 *   2. 去重（Dedupe）
 *   3. 失效检测（Health Check）
 *   4. 智能整理（Auto Organize）—— 簇可展开看具体书签
 *   5. 空文件夹清理（Empty Folders）—— 新增
 */

import { useEffect, useCallback, useState } from "react";
import { Modal, Button, List, Tag, Alert, Checkbox, Empty, Flex, Typography } from "antd";
import {
  Copy,
  HeartPulse,
  FolderTree,
  Check,
  RefreshCw,
  FolderX,
  LayoutDashboard,
  Hash,
} from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { collectBookmarkOverview, type BookmarkOverview } from "./bookmark-tools";
import { getBookmarkTree } from "@/chrome/bookmarks";
import { useSettingsStore } from "@/store";
import { useT } from "@/shared/i18n";
import { SiteIcon } from "@/shared/ui/SiteIcon";
import { BookmarkToolsOverview } from "./components/BookmarkToolsOverview";
import { BookmarkDedupePanel } from "./components/BookmarkDedupePanel";
import { BookmarkHealthPanel } from "./components/BookmarkHealthPanel";
import { useBookmarkDedupe } from "./hooks/use-bookmark-dedupe";
import { useBookmarkHealth } from "./hooks/use-bookmark-health";
import { useBookmarkOrganize } from "./hooks/use-bookmark-organize";
import { useBookmarkEmptyFolders } from "./hooks/use-bookmark-empty-folders";
import styles from "./bookmark-tools.module.less";

interface BookmarkToolsModalProps {
  open: boolean;
  onClose: () => void;
  onMutated: () => void;
}

/** 工具箱左侧导航的能力 key */
type ToolKey = "overview" | "dedupe" | "health" | "organize" | "empty";

export function BookmarkToolsModal({ open, onClose, onMutated }: BookmarkToolsModalProps) {
  const { t } = useT();
  const dedupStrictness = useSettingsStore((s) => s.settings.dedupStrictness) ?? "loose";

  const [activeTool, setActiveTool] = useState<ToolKey>("overview");

  // ── 总览 ──
  const [overview, setOverview] = useState<BookmarkOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  const refreshOverview = useCallback(async () => {
    setOverviewLoading(true);
    const tree = await getBookmarkTree();
    setOverview(collectBookmarkOverview(tree));
    setOverviewLoading(false);
  }, []);

  // 弹窗打开时拉一次总览（仅一次；关闭后不主动重拉，避免应用启动时多余请求）
  useEffect(() => {
    if (open && overview === null && !overviewLoading) {
      void refreshOverview();
    }
  }, [open, overview, overviewLoading, refreshOverview]);

  // ── 使用 Hooks ──
  const { dups, dupLoading, scanDuplicates, applyDedupe } = useBookmarkDedupe(
    dedupStrictness,
    onMutated,
    refreshOverview,
  );

  const {
    healthResults,
    healthLoading,
    healthProgress,
    healthPermission,
    healthFilter,
    setHealthFilter,
    filteredHealth,
    deadList,
    healthStats,
    checkHealth,
    applyRemoveDead,
  } = useBookmarkHealth(onMutated, refreshOverview);

  const {
    clusters,
    orgLoading,
    selectedClusters,
    setSelectedClusters,
    expandedCluster,
    setExpandedCluster,
    scanClusters,
    applyOrganize,
  } = useBookmarkOrganize(onMutated, refreshOverview);

  const { emptyFolders, emptyLoading, scanEmptyFolders, applyRemoveEmpty } =
    useBookmarkEmptyFolders(onMutated, refreshOverview);

  // 首次打开总览已由 useEffect 接管，这里不需额外调用

  // ────────────────────────────────────────────────────────
  // Renderers
  // ────────────────────────────────────────────────────────

  const navItems: Array<{ key: ToolKey; icon: React.ReactNode; label: string; badge?: number }> = [
    {
      key: "overview",
      icon: <LayoutDashboard size={ICON_SIZE.MEDIUM} />,
      label: t("总览"),
    },
    {
      key: "dedupe",
      icon: <Copy size={ICON_SIZE.MEDIUM} />,
      label: t("去重"),
      badge: dups?.length,
    },
    {
      key: "health",
      icon: <HeartPulse size={ICON_SIZE.MEDIUM} />,
      label: t("失效检测"),
      badge: deadList.length,
    },
    {
      key: "organize",
      icon: <FolderTree size={ICON_SIZE.MEDIUM} />,
      label: t("智能整理"),
      badge: clusters?.length,
    },
    {
      key: "empty",
      icon: <FolderX size={ICON_SIZE.MEDIUM} />,
      label: t("空文件夹"),
      badge: emptyFolders?.length,
    },
  ];

  // ── 智能整理 ──
  const renderOrganize = () => (
    <Flex vertical gap={20} className={styles["bm-tools__panel"]}>
      <Flex align="flex-start" gap={12} className={styles["bm-tools__panel-header"]}>
        <Flex vertical className={styles["bm-tools__panel-copy"]}>
          <Typography.Text className={styles["bm-tools__panel-title"]}>
            {t("智能整理")}
          </Typography.Text>
          <Typography.Text className={styles["bm-tools__panel-subtitle"]}>
            {t(
              '按域名聚类书签。选择想整理的分类，执行后会在"其他书签"下新建同名文件夹，所有同域书签移过去。',
            )}
          </Typography.Text>
        </Flex>
        <Flex align="center" gap={8} className={styles["bm-tools__panel-actions"]}>
          <Button
            type="primary"
            loading={orgLoading}
            icon={<RefreshCw size={ICON_SIZE.SMALL} />}
            onClick={() => {
              void scanClusters();
            }}
          >
            {t("开始扫描")}
          </Button>
          {clusters !== null && clusters.length > 0 && (
            <Button
              type="primary"
              icon={<Check size={ICON_SIZE.SMALL} />}
              onClick={() => {
                void applyOrganize();
              }}
              disabled={selectedClusters.size === 0}
            >
              {t("整理选中的 {count} 个分类", { count: selectedClusters.size })}
            </Button>
          )}
        </Flex>
      </Flex>

      {clusters === null && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('点击"开始扫描"查看结果')}
          className={styles["bm-tools__empty"]}
        />
      )}

      {clusters !== null && clusters.length === 0 && (
        <Alert type="success" showIcon message={t("没有可整理的大簇（需同域名≥ 3 个书签）。")} />
      )}

      {clusters !== null && clusters.length > 0 && (
        <Flex vertical gap={12} className={styles["bm-tools__list"]}>
          {clusters.map((c) => {
            const checked = selectedClusters.has(c.domain);
            const expanded = expandedCluster === c.domain;
            return (
              <Flex
                key={c.domain}
                vertical
                className={`${styles["bm-tools__group"]}${checked ? ` ${styles["is-checked"]}` : ""}`}
              >
                <Flex
                  align="center"
                  gap={10}
                  className={`${styles["bm-tools__group-header"]} ${styles["is-clickable"]}`}
                  onClick={() => {
                    const next = new Set(selectedClusters);
                    if (checked) next.delete(c.domain);
                    else next.add(c.domain);
                    setSelectedClusters(next);
                  }}
                >
                  <Checkbox checked={checked} onChange={() => undefined} />
                  <SiteIcon url={`https://${c.domain}`} />
                  <Typography.Text className={styles["bm-tools__group-title"]}>
                    {c.domain}
                  </Typography.Text>
                  <Tag color="blue" className={styles["bm-tools__tag--noborder"]}>
                    {t("{count} 个书签", { count: c.items.length })}
                  </Tag>
                  <Button
                    type="text"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedCluster(expanded ? null : c.domain);
                    }}
                  >
                    {expanded ? t("收起") : t("展开")}
                  </Button>
                </Flex>
                {expanded && (
                  <Flex vertical className={styles["bm-tools__group-body"]}>
                    {c.items.map((item) => (
                      <Flex
                        key={item.id}
                        className={`${styles["bm-tools__row"]} ${styles["is-mini"]}`}
                      >
                        <Flex vertical className={styles["bm-tools__row-main"]}>
                          <Typography.Text className={styles["bm-tools__row-title"]}>
                            {item.title || item.url}
                          </Typography.Text>
                          <Typography.Text className={styles["bm-tools__row-sub"]}>
                            {item.url}
                          </Typography.Text>
                        </Flex>
                      </Flex>
                    ))}
                  </Flex>
                )}
              </Flex>
            );
          })}
        </Flex>
      )}
    </Flex>
  );

  // ── 空文件夹 ──
  const renderEmpty = () => (
    <Flex vertical gap={20} className={styles["bm-tools__panel"]}>
      <Flex align="flex-start" gap={12} className={styles["bm-tools__panel-header"]}>
        <Flex vertical className={styles["bm-tools__panel-copy"]}>
          <Typography.Text className={styles["bm-tools__panel-title"]}>
            {t("空文件夹")}
          </Typography.Text>
          <Typography.Text className={styles["bm-tools__panel-subtitle"]}>
            {t("扫描完全不含书签的文件夹（包括嵌套都为空的子文件夹），一键清理。")}
          </Typography.Text>
        </Flex>
        <Flex align="center" gap={8} className={styles["bm-tools__panel-actions"]}>
          <Button
            type="primary"
            loading={emptyLoading}
            icon={<RefreshCw size={ICON_SIZE.SMALL} />}
            onClick={() => {
              void scanEmptyFolders();
            }}
          >
            {t("开始扫描")}
          </Button>
          {emptyFolders !== null && emptyFolders.length > 0 && (
            <Button
              danger
              icon={<Check size={ICON_SIZE.SMALL} />}
              onClick={() => {
                void applyRemoveEmpty();
              }}
            >
              {t("清理全部（共 {count} 个）", {
                count: emptyFolders.reduce((s, e) => s + e.size, 0),
              })}
            </Button>
          )}
        </Flex>
      </Flex>

      {emptyFolders === null && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('点击"开始扫描"查看结果')}
          className={styles["bm-tools__empty"]}
        />
      )}

      {emptyFolders !== null && emptyFolders.length === 0 && (
        <Alert type="success" showIcon message={t("没有空文件夹，结构干净。")} />
      )}

      {emptyFolders !== null && emptyFolders.length > 0 && (
        <List
          size="small"
          dataSource={emptyFolders}
          renderItem={(e) => (
            <List.Item>
              <Flex align="center" gap={12} className={styles["bm-tools__row"]}>
                <FolderX size={ICON_SIZE.MEDIUM} className={styles["is-warning"]} />
                <Flex vertical className={styles["bm-tools__row-main"]}>
                  <Typography.Text className={styles["bm-tools__row-title"]}>
                    {e.folder.title || t("未命名文件夹")}
                  </Typography.Text>
                  {e.size > 1 && (
                    <Typography.Text className={styles["bm-tools__row-sub"]}>
                      {t("嵌套连带删除 {count} 个空文件夹", { count: e.size })}
                    </Typography.Text>
                  )}
                </Flex>
              </Flex>
            </List.Item>
          )}
        />
      )}
    </Flex>
  );

  const renderActive = () => {
    switch (activeTool) {
      case "overview":
        return (
          <BookmarkToolsOverview
            overview={overview}
            overviewLoading={overviewLoading}
            onRefresh={() => {
              void refreshOverview();
            }}
          />
        );
      case "dedupe":
        return (
          <BookmarkDedupePanel
            dups={dups}
            dupLoading={dupLoading}
            scanDuplicates={scanDuplicates}
            applyDedupe={applyDedupe}
            dedupStrictness={dedupStrictness}
          />
        );
      case "health":
        return (
          <BookmarkHealthPanel
            healthResults={healthResults}
            healthLoading={healthLoading}
            healthProgress={healthProgress}
            healthPermission={healthPermission}
            healthFilter={healthFilter}
            setHealthFilter={setHealthFilter}
            filteredHealth={filteredHealth}
            deadList={deadList}
            healthStats={healthStats}
            checkHealth={checkHealth}
            applyRemoveDead={applyRemoveDead}
          />
        );
      case "organize":
        return renderOrganize();
      case "empty":
        return renderEmpty();
      default:
        return null;
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={920}
      title={
        <Flex align="center" gap={8} className={styles["bm-tools__title"]}>
          <Hash size={ICON_SIZE.MEDIUM} />
          <Typography.Text>{t("书签工具箱")}</Typography.Text>
          {overview !== null && (
            <Typography.Text className={styles["bm-tools__title-meta"]}>
              {t("共 {bookmarks} 个书签·{folders} 个文件夹", {
                bookmarks: overview.total,
                folders: overview.folders,
              })}
            </Typography.Text>
          )}
        </Flex>
      }
      destroyOnHidden
      className={styles["bm-tools__modal"]}
    >
      <Flex gap={24} className={styles["bm-tools__layout"]}>
        <Flex vertical gap={4} className={styles["bm-tools__nav"]}>
          {navItems.map((item) => (
            <Button
              key={item.key}
              htmlType="button"
              className={`${styles["bm-tools__nav-item"]}${activeTool === item.key ? ` ${styles["is-active"]}` : ""}`}
              onClick={() => setActiveTool(item.key)}
            >
              <Flex align="center" gap={8} className={styles["bm-tools__nav-content"]}>
                <Typography.Text className={styles["bm-tools__nav-icon"]}>
                  {item.icon}
                </Typography.Text>
                <Typography.Text className={styles["bm-tools__nav-label"]}>
                  {item.label}
                </Typography.Text>
                {item.badge !== undefined && item.badge > 0 && (
                  <Typography.Text className={styles["bm-tools__nav-badge"]}>
                    {item.badge}
                  </Typography.Text>
                )}
              </Flex>
            </Button>
          ))}
        </Flex>
        <Flex vertical className={styles["bm-tools__content"]}>
          {renderActive()}
        </Flex>
      </Flex>
    </Modal>
  );
}
