/**
 * BookmarkToolbar — 顶部工具栏
 *
 * 包含：视图切换（书签树/最近）/ 搜索框 / 新增 / 排序 / 导入导出 / 多选 / 工具
 */

import { Input, Segmented, Button, Tooltip, Dropdown, Upload, Space } from "antd";
import type { MenuProps, UploadProps } from "antd";
import {
  Search,
  BookmarkPlus,
  FolderPlus,
  Wrench,
  Download,
  Upload as UploadIcon,
  ListTree,
  Clock,
  Link2,
} from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useT } from "@/shared/i18n";
import type { BookmarkSortMode, BookmarkViewTab } from "../hooks/use-bookmark-view-prefs";

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  viewTab: BookmarkViewTab;
  onViewTabChange: (v: BookmarkViewTab) => void;
  sortMode: BookmarkSortMode;
  onSortChange: (m: BookmarkSortMode) => void;
  onAddBookmark: () => void;
  onAddFolder: () => void;
  onExport: (format: "html" | "json" | "md") => void;
  onImport: NonNullable<UploadProps["beforeUpload"]>;
  selectionMode: boolean;
  onToggleSelection: () => void;
  showSelection: boolean;
  onCheckLinks: () => void;
  onFindDuplicates: () => void;
  linkCheckRunning: boolean;
  importLoading?: boolean;
}

export function BookmarkToolbar({
  query,
  onQueryChange,
  viewTab,
  onViewTabChange,
  sortMode,
  onSortChange,
  onAddBookmark,
  onAddFolder,
  onExport,
  onImport,
  selectionMode,
  onToggleSelection,
  showSelection,
  onCheckLinks,
  onFindDuplicates,
  linkCheckRunning,
  importLoading,
}: Props) {
  const { t } = useT();

  const sortItems: MenuProps["items"] = [
    { key: "default", label: t("默认排序"), onClick: () => onSortChange("default") },
    { key: "name", label: t("按名称排序"), onClick: () => onSortChange("name") },
    { key: "recent", label: t("按最近"), onClick: () => onSortChange("recent") },
  ];

  const exportItems: MenuProps["items"] = [
    { key: "html", label: "HTML (Netscape)", onClick: () => onExport("html") },
    { key: "json", label: "JSON", onClick: () => onExport("json") },
    { key: "md", label: "Markdown", onClick: () => onExport("md") },
  ];

  const toolItems: MenuProps["items"] = [
    {
      key: "linkcheck",
      icon: <Link2 size={ICON_SIZE.SMALL} />,
      label: t("检测失效链接"),
      onClick: onCheckLinks,
      disabled: linkCheckRunning,
    },
    {
      key: "dupes",
      icon: <Wrench size={ICON_SIZE.SMALL} />,
      label: t("查找重复书签"),
      onClick: onFindDuplicates,
    },
  ];

  return (
    <div className="bookmark-toolbar">
      <Segmented
        value={viewTab}
        onChange={(v) => onViewTabChange(v as BookmarkViewTab)}
        options={[
          { value: "tree", icon: <ListTree size={14} />, label: t("书签树") },
          { value: "recent", icon: <Clock size={14} />, label: t("最近添加") },
        ]}
        aria-label={t("视图切换")}
      />
      <Input
        allowClear
        prefix={<Search size={ICON_SIZE.SMALL} />}
        placeholder={t("搜索书签…")}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        aria-label={t("搜索书签")}
        className="bookmark-toolbar__search"
      />
      <Space size={4} wrap>
        <Tooltip title={t("添加书签")}>
          <Button
            icon={<BookmarkPlus size={ICON_SIZE.SMALL} />}
            aria-label={t("添加书签")}
            onClick={onAddBookmark}
          />
        </Tooltip>
        <Tooltip title={t("新建文件夹")}>
          <Button
            icon={<FolderPlus size={ICON_SIZE.SMALL} />}
            aria-label={t("新建文件夹")}
            onClick={onAddFolder}
          />
        </Tooltip>
        <Tooltip title={t("排序方式")}>
          <Dropdown menu={{ items: sortItems }} trigger={["click"]}>
            <Button
              aria-label={t("排序")}
              className={sortMode === "default" ? "bookmark-toolbar__sort--default" : "bookmark-toolbar__sort--active"}
            >
              {t("排序")}
            </Button>
          </Dropdown>
        </Tooltip>
        <Dropdown menu={{ items: exportItems }} trigger={["click"]}>
          <Tooltip title={t("导出")}>
            <Button  icon={<Download size={ICON_SIZE.SMALL} />} aria-label={t("导出")} />
          </Tooltip>
        </Dropdown>
        <Upload
          beforeUpload={(file, fileList) => {
            // 把 RcFile 当作 File 用，FileReader 只用到 File 自身 API
            return onImport(file, fileList);
          }}
          showUploadList={false}
          accept=".html,.json,.md"
        >
          <Tooltip title={t("导入")}>
            <Button
              icon={<UploadIcon size={ICON_SIZE.SMALL} />}
              aria-label={t("导入")}
              loading={importLoading}
            />
          </Tooltip>
        </Upload>
        {showSelection && (
          <Tooltip title={selectionMode ? t("退出多选") : t("进入多选模式")}>
            <Button
              type={selectionMode ? "primary" : "default"}
              onClick={onToggleSelection}
              aria-pressed={selectionMode}
            >
              {t("多选")}
            </Button>
          </Tooltip>
        )}
        <Dropdown menu={{ items: toolItems }} trigger={["click"]}>
          <Tooltip title={t("工具")}>
            <Button
              icon={<Wrench size={ICON_SIZE.SMALL} />}
              aria-label={t("工具")}
              loading={linkCheckRunning}
            />
          </Tooltip>
        </Dropdown>
      </Space>
    </div>
  );
}

// 静默 UploadProps 类型引用（保留 Upload 类型信息以便 IDE 跳转）
void (null as unknown as UploadProps);
