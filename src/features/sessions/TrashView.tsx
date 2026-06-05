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
  const [items, setItems] = useState<TrashedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTrashItems();
      setItems(data);
    } catch (err) {
      feedback.error(t("trash.loadFailed"), err);
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
        feedback.success(t("trash.restoreSuccess", { count: trashedItem.tabs.length }));
      } catch (err) {
        feedback.error(t("trash.restoreFailed"), err);
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
        feedback.error(t("trash.deleteFailed"), err);
      }
    },
    [refresh, t],
  );

  const handleClearAll = useCallback(async () => {
    try {
      await clearTrash();
      await refresh();
      feedback.success(t("trash.clearSuccess"));
    } catch (err) {
      feedback.error(t("trash.clearFailed"), err);
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
          title={t("trash.empty")}
          description={t("trash.emptyDescription")}
          icon={<Trash2 size={ICON_SIZE.HERO} />}
          hints={[t("trash.emptyHint1"), t("trash.emptyHint2"), t("trash.emptyHint3")]}
        />
      ) : (
        <Flex vertical gap={12}>
          {/* 工具栏：统计 + 清空 */}
          <Flex justify="space-between" align="center" className={styles["trash-toolbar"]}>
            <Typography.Text className={styles["trash-toolbar-count"]}>
              {t("trash.count", { count: items.length })} · {totalTabs} {t("标签页")}
            </Typography.Text>
            <Popconfirm
              title={t("trash.clearConfirm")}
              description={t("trash.clearDesc")}
              onConfirm={() => void handleClearAll()}
              okText={t("trash.clear")}
              cancelText={t("取消")}
              okButtonProps={{ danger: true }}
            >
              <Button danger size="small" icon={<Trash2 size={ICON_SIZE.SMALL} />}>
                {t("trash.clear")}
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
                  <Tooltip title={t("trash.restore")}>
                    <Button
                      size="small"
                      type="primary"
                      icon={<RotateCcw size={ICON_SIZE.SMALL} />}
                      onClick={() => void handleRestore(item)}
                    >
                      {t("trash.restore")}
                    </Button>
                  </Tooltip>
                  <Tooltip title={t("trash.delete")}>
                    <Button
                      size="small"
                      danger
                      icon={<X size={ICON_SIZE.SMALL} />}
                      onClick={() => void handleDelete(item.id)}
                    />
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
                  {item.tabs.slice(0, 8).map((tab) => (
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
                    <Tag>+{item.tabs.length - 8}</Tag>
                  )}
                </Flex>
              </Flex>
            </Card>
          ))}
        </Flex>
      )}
    </div>
  );
}
