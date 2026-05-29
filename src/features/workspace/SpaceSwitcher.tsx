/**
 * SpaceSwitcher —— 空间切换组件
 *
 * UX-P0-06：将 pageMode 概念升级为 Space，
 * 在 AppHeader 中显示 3 个空间入口：workspace / trending / devtools
 *
 * 当前空间高亮，点击切换空间（通过 URL Hash 路由驱动）
 */

import { Button, Tooltip, Flex } from "antd";
import { Monitor, TrendingUp, Wrench } from "lucide-react";
import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useT } from "@/shared/i18n";
import type { SpaceId } from "@/shared/routing";

interface SpaceSwitcherProps {
  /** 当前空间 ID */
  currentSpaceId: SpaceId | string;
  /** 切换空间回调 */
  onSwitchSpace: (spaceId: SpaceId) => void;
}

const SPACE_DEFS: { id: SpaceId; icon: typeof Monitor; labelKey: string }[] = [
  { id: "workspace", icon: Monitor, labelKey: "工作台" },
  { id: "trending", icon: TrendingUp, labelKey: "热榜" },
  { id: "devtools", icon: Wrench, labelKey: "开发工具" },
];

export function SpaceSwitcher({ currentSpaceId, onSwitchSpace }: SpaceSwitcherProps) {
  const { t } = useT();

  return (
    <Flex align="center" gap={2} className="app-space-switcher">
      {SPACE_DEFS.map(({ id, icon: Icon, labelKey }) => {
        const isActive = currentSpaceId === id;
        return (
          <Tooltip key={id} title={t(labelKey)}>
            <Button
              size="small"
              type={isActive ? "primary" : "text"}
              icon={<Icon size={ICON_SIZE.SMALL} />}
              onClick={() => onSwitchSpace(id)}
              aria-label={t(labelKey)}
              className={`app-space-switcher__item${isActive ? " is-active" : ""}`}
            />
          </Tooltip>
        );
      })}
    </Flex>
  );
}
