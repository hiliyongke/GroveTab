/**
 * InsightsFooter — 数据导出与清除
 */

import { Button, Flex, Popconfirm } from "antd";
import { Download } from "lucide-react";
import { useT } from "@/shared/i18n";

interface Props {
  onExport: () => void;
  onClear: () => void;
  disabled: boolean;
}

export function InsightsFooter({ onExport, onClear, disabled }: Props) {
  const { t } = useT();
  return (
    <Flex className="insights-footer" gap={8} justify="flex-end">
      <Button
        icon={<Download size={12} />}
        onClick={onExport}
        disabled={disabled}
      >
        {t("导出数据")}
      </Button>
      <Popconfirm
        title={t("将清空所有本地统计数据，不可恢复。继续？")}
        okText={t("删除")}
        cancelText={t("取消")}
        onConfirm={onClear}
        disabled={disabled}
      >
        <Button danger disabled={disabled}>
          {t("清除所有统计")}
        </Button>
      </Popconfirm>
    </Flex>
  );
}
