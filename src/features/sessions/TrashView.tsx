/**
 * TrashView — 回收站视图
 *
 * 展示已关闭的标签页分组，支持批量恢复、逐一分组删除、一键清空。
 */

import { useCallback, useEffect, useState } from "react";
import { Button, Card, Popconfirm, Space, Tag, Tooltip, Flex, Typography, Spin } from "antd";
import { Trash2, RotateCcw, Clock, X } from "lucide-react";
import { FeatureEmptyState } from "@/shared/ui/FeatureEmptyState";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useT } from "@/shared/i18n";
import { useFeatureFlagStore } from "@/shared/store/feature-flag-slice";
import { feedback } from "@/shared/ui/feedback";
import { getTrashItems, removeFromTrash, clearTrash } from "@/repositories/trash-repo";
import { createTab } from "@/chrome";
import type { TrashedTab, TrashedItem } from "@/shared/types";
import { formatRelativeTime } from "@/shared/utils/relative-time";
import styles from "./styles/trash.module.less";

function TabFavicon({ tab }: { tab: TrashedTab }) {
  if (tab.favIconUrl) {
    return (
      <img
        src={tab.favIconUrl}
        alt=""
        className={styles["trash-tab-favicon"]}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  return <div className={styles["trash-tab-favicon--placeholder"]} />;
}

export function TrashView() {
  const { t } = useT();
  const archiveTrashMerged = useFeatureFlagStore((s) => s.flags.archive_trash_merged);
  const [items, setItems] = useState<TrashedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMoreIds, setShowMoreIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTrashItems();
      setItems(data);
    } catch (err) {
      feedback.error(t("回收站加载失败"), err);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleRestore = useCallback(
    async (trashedItem: TrashedItem) => {
      try {
        await Promise.all(trashedItem.tabs.map((tab) => createTab({ url: tab.url })));
        await removeFromTrash(trashedItem.id);
        await refresh();
        feedback.success(t("已恢复 {count} 个标签页", { count: trashedItem.tabs.length }));
      } catch (err) {
        feedback.error(t("恢复失败"), err);
      }
    },
    [refresh, t],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await removeFromTrash(id);
        await refresh();
      } catch (err) {
        feedback.error(t("删除失败"), err);
      }
    },
    [refresh, t],
  );

  const handleClearAll = useCallback(async () => {
    try {
      await clearTrash();
      await refresh();
      feedback.success(t("回收站已清空"));
    } catch (err) {
      feedback.error(t("清空失败"), err);
    }
  }, [refresh, t]);

  const totalTabs = items.reduce((sum, item) => sum + item.tabs.length, 0);

  return (
    <div className={styles["trash-shell"]}>
      {loading ? (
        <Flex align="center" justify="center" className={styles["trash-loading"]}>
          <Spin />
        </Flex>
      ) : items.length === 0 ? (
        <FeatureEmptyState
          title={t("回收站为空")}
          description={t("关闭的标签页会暂时存放在这里")}
          icon={<Trash2 size={ICON_SIZE.HERO} />}
          hints={[t("关闭标签页后会自动加入回收站"), t("可以随时恢复或永久删除"), t("回收站内容在浏览器重启后仍保留")]}
        />
      ) : (
        <Flex vertical gap={12}>
          {/* 工具栏：统计 + 清空 */}
          <Flex justify="space-between" align="center" className={styles["trash-toolbar"]}>
            <Typography.Text className={styles["trash-toolbar-count"]}>
              {t("共 {count} 组", { count: items.length })} · {totalTabs} {t("标签页")}
            </Typography.Text>
            <Popconfirm
              title={t("确认清空回收站")}
              description={t("清空后不可恢复，确定要清空吗？")}
              onConfirm={() => void handleClearAll()}
              okText={t("清空回收站")}
              cancelText={t("取消")}
              okButtonProps={{ danger: true }}
            >
              <Button danger size="small" icon={<Trash2 size={ICON_SIZE.SMALL} />}>
                {t("清空回收站")}
              </Button>
            </Popconfirm>
          </Flex>

          {/* 分组卡片列表 */}
          {items.map((item) => (
            <Card
              key={item.id}
              size="small"
              className={styles["trash-card"]}
              title={
                <Flex align="center" gap="small">
                  <Typography.Text className={styles["trash-card__title"]}>
                    {item.name}
                  </Typography.Text>
                  <Tag color="blue">{item.tabs.length}</Tag>
                </Flex>
              }
              extra={
                <Space size={4}>
                  <Tooltip title={t("恢复")}>
                    <Button
                      size="small"
                      type="primary"
                      icon={<RotateCcw size={ICON_SIZE.SMALL} />}
                      onClick={() => void handleRestore(item)}
                    >
                      {t("恢复")}
                    </Button>
                  </Tooltip>
                  <Tooltip title={t("永久删除")}>
                    <Popconfirm
                      title={t("确认永久删除该分组？")}
                      onConfirm={() => void handleDelete(item.id)}
                      okText={t("删除")}
                      cancelText={t("取消")}
                      okButtonProps={{ danger: true }}
                    >
                      <Button
                        size="small"
                        danger
                        icon={<X size={ICON_SIZE.SMALL} />}
                      />
                    </Popconfirm>
                  </Tooltip>
                </Space>
              }
            >
              <Flex vertical gap={8}>
                <Flex align="center" gap={4}>
                  <Clock size={ICON_SIZE.XS} />
                  <Typography.Text className={styles["trash-card__meta-text"]}>
                    {formatRelativeTime(item.trashedAt, t)}
                  </Typography.Text>
                </Flex>

                <Flex wrap gap={6} className={styles["trash-tab-chips"]}>
                  {(showMoreIds.has(item.id) ? item.tabs : item.tabs.slice(0, 8)).map((tab) => (
                    <Tooltip key={tab.id} title={tab.title || tab.url}>
                      <span className={styles["trash-tab-chip"]}>
                        <TabFavicon tab={tab} />
                        <span className={styles["trash-tab-chip__title"]}>
                          {tab.title || tab.url}
                        </span>
                      </span>
                    </Tooltip>
                  ))}
                  {item.tabs.length > 8 && (
                    showMoreIds.has(item.id) ? (
                      <Button size="small" type="link" onClick={(e) => { e.stopPropagation(); setShowMoreIds((prev) => { const n = new Set(prev); n.delete(item.id); return n; }); }}>
                        {t("展开全部")}
                      </Button>
                    ) : (
                      <Button size="small" type="link" onClick={(e) => { e.stopPropagation(); setShowMoreIds((prev) => new Set(prev).add(item.id)); }}>
                        {t("显示全部 {count} 个", { count: item.tabs.length - 8 })}
                      </Button>
                    )
                  )}
                </Flex>
              </Flex>
            </Card>
          ))}
        </Flex>
      )}
      {archiveTrashMerged && items.length > 0 && (
        <Flex justify="center" style={{ marginTop: "var(--app-space-6)" }}>
          <Typography.Text type="secondary">
            {t("回收站内容已同步到")}
            <Button
              type="link"
              size="small"
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent("navigate", {
                    detail: { view: "archive", filter: "trash" },
                  }),
                );
              }}
            >
              {t("归档视图")}
            </Button>
          </Typography.Text>
        </Flex>
      )}
    </div>
  );
}
