/**
 * SelectionModeNotice —— 多选模式提示条。
 *
 * 功能：显示当前已选标签页的数量/域名/窗口统计，并提供「全选 / 清空 / 退出」操作。
 * 历史来源：从早期 WorkspaceOverview 组件中拆分独立。
 */

import { Button, Card, Space, Flex } from "antd";
import type { LiveTab } from "@/shared/types";
import { useT } from "@/shared/i18n";
import styles from "./styles/views.module.less";

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
      size="small"
      className={styles["app-selection-notice"]}
      classNames={{ body: styles["app-selection-notice__body"] }}
    >
      <Flex className={styles["app-selection-notice__body"]}>
        <Flex vertical className={styles["app-selection-notice__summary"]}>
          <Flex className={styles["app-selection-notice__title"]}>{t("selection.title")}</Flex>
          <Flex className={styles["app-selection-notice__meta"]}>
            {selectedCount > 0
              ? t("selection.summary", {
                  count: selectedCount,
                  domains: selectedDomainCount,
                  windows: selectedWindowCount,
                })
              : t("selection.empty")}
          </Flex>
          <Flex className={styles["app-selection-notice__hint"]}>{t("selection.hint")}</Flex>
        </Flex>

        <Space size={6} wrap>
          <Button size="small" onClick={onSelectAll}>
            {t("selection.selectAll")}
          </Button>
          <Button size="small" onClick={onClearSelection} disabled={selectedCount === 0}>
            {t("selection.clear")}
          </Button>
          <Button size="small" type="text" onClick={onExitSelectionMode}>
            {t("selection.exit")}
          </Button>
        </Space>
      </Flex>
    </Card>
  );
}
