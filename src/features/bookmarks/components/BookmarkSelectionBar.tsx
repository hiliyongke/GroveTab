/**
 * BookmarkSelectionBar — 多选模式下的批量操作栏
 *
 * 仅在 selectionMode + hasSelection 时显示。
 */

import { Button, Popconfirm } from "antd";
import { useT } from "@/shared/i18n";

interface Props {
  count: number;
  onSelectAll: () => void;
  onClear: () => void;
  onBatchDelete: () => void;
}

export function BookmarkSelectionBar({ count, onSelectAll, onClear, onBatchDelete }: Props) {
  const { t } = useT();
  return (
    <div className="bookmark-selection-bar" role="toolbar" aria-label={t("批量操作")}>
      <span className="bookmark-selection-bar__count">
        {t("已选 {n} 项", { n: count })}
      </span>
      <Button size="small" onClick={onSelectAll}>
        {t("全选")}
      </Button>
      <Button size="small" onClick={onClear}>
        {t("取消")}
      </Button>
      <Popconfirm
        title={t("确定删除选中的 {n} 项吗？", { n: count })}
        okText={t("删除")}
        cancelText={t("取消")}
        onConfirm={onBatchDelete}
      >
        <Button size="small" danger>
          {t("批量删除")}
        </Button>
      </Popconfirm>
    </div>
  );
}
