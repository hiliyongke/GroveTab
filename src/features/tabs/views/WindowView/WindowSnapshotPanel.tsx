/**
 * WindowSnapshotPanel — 窗口快照面板
 *
 * 显示在工具栏下拉面板中，列出所有快照：
 *   - 支持命名/重命名/删除
 *   - 恢复时提供选项：恢复到原始窗口/合并到当前窗口
 */

import { useEffect, useState, useCallback, memo } from "react";
import { Button, Dropdown, Flex, Input, List, Typography, Empty, theme } from "antd";
import { Clock, Download, MoreHorizontal, RotateCcw, Save, Trash2 } from "lucide-react";

import type { ArchivedSession } from "@/shared/types";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useT } from "@/shared/i18n";
import { useSessionsStore } from "@/store";
import { saveWindowSnapshot, restoreWindowSnapshot } from "@/services/window-snapshot";
import { feedback } from "@/shared/ui/feedback";
import { formatRelativeTime } from "@/shared/utils/relative-time";

interface WindowSnapshotPanelProps {
  windowId: number;
  onRefresh: () => void;
}

export const WindowSnapshotPanel = memo(function WindowSnapshotPanel({
  windowId,
  onRefresh,
}: WindowSnapshotPanelProps) {
  const { t } = useT();
  const { token } = theme.useToken();
  const sessions = useSessionsStore((s) => s.sessions);
  const snapshots = sessions.filter((s) => s.source === "snapshot");
  const refreshSessions = useSessionsStore((s) => s.refreshSessions);
  const deleteSession = useSessionsStore((s) => s.deleteSession);
  const renameSession = useSessionsStore((s) => s.renameSession);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      await saveWindowSnapshot(windowId);
      await refreshSessions();
      feedback.success(t("快照已保存"));
    } catch (err) {
      feedback.error(t("保存快照失败"), err);
    } finally {
      setSaving(false);
    }
  }, [saving, windowId, refreshSessions, t]);

  const handleRestore = useCallback(
    async (session: ArchivedSession, strategy: "new_window" | "current_window") => {
      try {
        const { restored } = await restoreWindowSnapshot(session.id, strategy);
        onRefresh();
        feedback.success(t("已恢复 {count} 个标签", { count: restored }));
      } catch (err) {
        feedback.error(t("恢复快照失败"), err);
      }
    },
    [onRefresh, t],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteSession(id);
        feedback.success(t("快照已删除"));
      } catch (err) {
        feedback.error(t("删除失败"), err);
      }
    },
    [deleteSession, t],
  );

  const handleRename = useCallback(
    (id: string, currentName: string) => {
      // 用变量收集输入值，避免双向状态与 DOM querySelector 耦合
      let nextName = currentName;
      feedback.modal.confirm({
        title: t("重命名快照"),
        content: (
          <Input
            id="snapshot-rename-input"
            defaultValue={currentName}
            onChange={(e) => {
              nextName = e.target.value;
            }}
          />
        ),
        onOk: async () => {
          await renameSession(id, nextName);
        },
      });
    },
    [renameSession, t],
  );

  return (
    <Flex vertical gap={8} style={{ width: 280, maxHeight: 400, overflow: "auto", padding: 4 }}>
      <Button
        type="primary"
        size="small"
        icon={<Save size={ICON_SIZE.SMALL} />}
        loading={saving}
        onClick={() => void handleSave()}
        block
      >
        {t("保存当前窗口快照")}
      </Button>

      {snapshots.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t("暂无快照")}
          style={{ margin: "12px 0" }}
        />
      ) : (
        <List
          size="small"
          dataSource={snapshots}
          renderItem={(session) => (
            <List.Item
              style={{
                padding: "6px 4px",
                borderBlockEndColor: token.colorBorderSecondary,
              }}
              actions={[
                <Dropdown
                  key="actions"
                  menu={{
                    items: [
                      {
                        key: "restore-new",
                        icon: <RotateCcw size={ICON_SIZE.SMALL} />,
                        label: t("恢复到新窗口"),
                        onClick: () => void handleRestore(session, "new_window"),
                      },
                      {
                        key: "restore-current",
                        icon: <Download size={ICON_SIZE.SMALL} />,
                        label: t("合并到当前窗口"),
                        onClick: () => void handleRestore(session, "current_window"),
                      },
                      { type: "divider" },
                      {
                        key: "rename",
                        label: t("重命名"),
                        onClick: () => void handleRename(session.id, session.name),
                      },
                      {
                        key: "delete",
                        danger: true,
                        icon: <Trash2 size={ICON_SIZE.SMALL} />,
                        label: t("删除"),
                        onClick: () => void handleDelete(session.id),
                      },
                    ],
                  }}
                  trigger={["click"]}
                >
                  <Button
                    type="text"
                    size="small"
                    icon={<MoreHorizontal size={ICON_SIZE.SMALL} />}
                  />
                </Dropdown>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Typography.Text style={{ fontSize: 12, fontWeight: 500 }} ellipsis>
                    {session.name}
                  </Typography.Text>
                }
                description={
                  <Flex gap={4} align="center">
                    <Clock size={10} style={{ color: token.colorTextQuaternary }} />
                    <Typography.Text style={{ fontSize: 11, color: token.colorTextTertiary }}>
                      {formatRelativeTime(session.createdAt, t)}
                    </Typography.Text>
                    <Typography.Text style={{ fontSize: 11, color: token.colorTextQuaternary }}>
                      ({session.tabCount} 标签)
                    </Typography.Text>
                  </Flex>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Flex>
  );
});
