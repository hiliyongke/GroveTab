/**
 * BookmarkTreeView — 书签树状视图
 *
 * 支持两种排布方向：
 *   - horizontal（脑图/思维导图风格）：根在左，子节点向右逐级展开
 *   - vertical  （组织架构图风格）  ：根在上，子节点向下逐级展开
 *
 * 设计要点：
 *   - 父子节点之间用 SVG 贝塞尔曲线连接，柔和过渡
 *   - 文件夹节点可点击折叠/展开，默认仅展开第一层
 *   - 叶子（书签）节点复用 favicon + accent 色，点击直接打开
 *   - 纯 CSS/SVG 实现，不引入第三方依赖
 *
 * 重构说明：
 *   - 提取 TreeLeafNode、TreeFolderNode、PanZoom 到 components/
 *   - 提取 useShowHost、useCenterOnExpand 到 hooks/
 *   - 提取工具函数到 utils/tree-helpers.ts
 *   - 修复硬编码中文 "空" → t("空")
 */

import { useCallback } from "react";
import { Button, Flex } from "antd";
import { Eye, EyeOff } from "lucide-react";
import type { BookmarkNode } from "@/chrome/bookmarks";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useT } from "@/shared/i18n";
import { TreeFolderNode } from "./components/TreeFolderNode";
import { PanZoom } from "./components/PanZoom";
import { ShowHostContext, useShowHost } from "./hooks/use-show-host";
import {
  CenterOnExpandContext,
  type PanZoomHandle,
  useCenterOnExpand,
} from "./hooks/use-center-on-expand";
import styles from "./styles/bookmark-tree.module.less";

/** 树排布方向 */
export type TreeOrientation = "horizontal" | "vertical";

export { PanZoomHandle };

interface BookmarkTreeViewProps {
  topSections: BookmarkNode[];
  onOpenBookmark: (url: string) => void;
  resolveTitle: (n: BookmarkNode) => string;
  orientation?: TreeOrientation;
}

/**
 * 主组件：书签树
 * - orientation='horizontal'：脑图风格，根在左，子节点向右展开
 * - orientation='vertical'  ：组织架构图风格，根在上，子节点向下展开
 */
export function BookmarkTreeView({
  topSections,
  onOpenBookmark,
  resolveTitle,
  orientation = "horizontal",
}: BookmarkTreeViewProps) {
  const { t } = useT();
  const handleOpen = useCallback((url: string) => onOpenBookmark(url), [onOpenBookmark]);
  const { panZoomRef, centerOnExpand } = useCenterOnExpand();
  const { showHost, toggleShowHost } = useShowHost();

  const extraToolbar = (
    <Button
      type="text"
      className={`${styles["panzoom-btn"]}${showHost ? ` ${styles["panzoom-btn--active"]}` : ""}`}
      onClick={toggleShowHost}
      title={showHost ? t("隐藏域名") : t("显示域名")}
      aria-label={showHost ? t("隐藏域名") : t("显示域名")}
      aria-pressed={showHost}
    >
      {showHost ? <Eye size={ICON_SIZE.SMALL} /> : <EyeOff size={ICON_SIZE.SMALL} />}
    </Button>
  );

  return (
    <Flex vertical className={`${styles.wrap} is-${orientation}${showHost ? " show-host" : ""}`}>
      <ShowHostContext.Provider value={showHost}>
        <CenterOnExpandContext.Provider value={centerOnExpand}>
          <PanZoom ref={panZoomRef} extraToolbar={extraToolbar} orientation={orientation}>
            <Flex vertical className={styles.canvas}>
              <Flex vertical className={styles.roots}>
                {topSections.map((section, idx) => (
                  <TreeFolderNode
                    key={section.id}
                    folder={section}
                    onOpenBookmark={handleOpen}
                    resolveTitle={resolveTitle}
                    defaultExpanded={idx === 0}
                    depth={0}
                    orientation={orientation}
                  />
                ))}
              </Flex>
            </Flex>
          </PanZoom>
        </CenterOnExpandContext.Provider>
      </ShowHostContext.Provider>
    </Flex>
  );
}
