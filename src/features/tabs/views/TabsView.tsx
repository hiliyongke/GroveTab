/**
 * TabsView —— 标签页主视图的布局分发器
 *
 * 将原 domain / compact / grid 三个视图合并为统一的 "tabs" 视图，
 * 内部通过 settings.tabsLayout 切换具体呈现方式：
 *   - 'masonry'（默认）：按域名分组的瀑布流多列布局 → DomainGroupView
 *   - 'compact'        ：虚拟化紧凑列表 → CompactView
 *   - 'grid'           ：卡片网格 → GridView
 *
 * 设计意图：降低用户认知负担，ViewTabs 上只显示一个 "标签页" 入口，
 * 布局细调通过设置面板或视图内工具栏完成。
 *
 * 统一工具栏（TabsToolbar）：
 *   - 搜索过滤（按标题/URL/域名）
 *   - 布局模式切换（masonry/compact/grid）
 *   - 卡片密度切换（S/M/L）
 */

import { useState } from "react";
import { Flex } from "antd";
import { useSettingsStore } from "@/store";
import { DomainGroupView } from "./DomainGroupView";
import { CompactView } from "./CompactView";
import { GridView } from "./GridView";
import { TabsToolbar } from "../toolbar/TabsToolbar";

export function TabsView() {
  const layout = useSettingsStore((s) => s.settings.tabsLayout ?? "masonry");
  const [filterQuery, setFilterQuery] = useState("");

  return (
    <Flex vertical gap="middle">
      <TabsToolbar filterQuery={filterQuery} onFilterChange={setFilterQuery} />
      {layout === "compact" ? (
        <CompactView filterQuery={filterQuery} />
      ) : layout === "grid" ? (
        <GridView filterQuery={filterQuery} />
      ) : (
        <DomainGroupView filterQuery={filterQuery} />
      )}
    </Flex>
  );
}
