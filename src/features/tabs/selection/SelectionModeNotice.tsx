/**
 * SelectionModeNotice —— 多选模式提示条。
 *
 * 功能：显示当前已选标签页的数量/域名/窗口统计，并提供「全选 / 清空 / 退出」操作。
 * 历史来源：从早期 WorkspaceOverview 组件中拆分独立。
 */

import { Button, Card, Space, Flex } from "antd";
import type { LiveTab } from "@/shared/types";
import { useT } from "@/shared/i18n";
import styles from "../styles/views.module.less";

interface SelectionModeNoticeProps {
  selectedTabs: LiveTab[];
  onSelectAll: () => void;
  onClearSelection: () => void;
  onExitSelectionMode: () => void;
}

export function SelectionModeNotice({
  selectedTabs,
  onSelectAll,
  onClearSelection,
  onExitSelectionMode,
}: SelectionModeNoticeProps) {
  const { t } = useT();

  const selectedCount = selectedTabs.length;
  const selectedDomainCount = new Set(selectedTabs.map((tab) => tab.hostname)).size;
  const selectedWindowCount = new Set(selectedTabs.map((tab) => tab.windowId)).size;

  return (
    <Card
      className={styles["app-selection-notice"]}
      classNames={{ body: styles["app-selection-notice__body"] }}
    >
      <Flex className={styles["app-selection-notice__body"]}>
        <Flex vertical className={styles["app-selection-notice__summary"]}>
          <Flex className={styles["app-selection-notice__title"]}>{t("多选模式")}</Flex>
          <Flex className={styles["app-selection-notice__meta"]}>
            {selectedCount > 0
              ? t("已选 {count} 个标签（{domains} 个域名 / {windows} 个窗口）", {
                  count: selectedCount,
                  domains: selectedDomainCount,
                  windows: selectedWindowCount,
                })
              : t("未选择任何标签页，点击标签开始多选")}
          </Flex>
          <Flex className={styles["app-selection-notice__hint"]}>
            {t("按住 Ctrl/Cmd 点击标签进行多选；Shift 点击可选中范围")}
          </Flex>
        </Flex>

        <Space size={6} wrap>
          <Button  onClick={onSelectAll}>
            {t("全选")}
          </Button>
          <Button  onClick={onClearSelection} disabled={selectedCount === 0}>
            {t("取消选择")}
          </Button>
          <Button  type="text" onClick={onExitSelectionMode}>
            {t("退出多选")}
          </Button>
        </Space>
      </Flex>
    </Card>
  );
}
