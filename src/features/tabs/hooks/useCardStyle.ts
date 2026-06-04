/**
 * useGroupCardSettings / useCardRadius — 分组卡片公共 hook
 *
 * DomainGroupCard 与 TabGroupCard 共享的设置读取 + 圆角计算。
 */

import { useMemo } from "react";
import { theme } from "antd";
import type { GroupCardAccentBarPosition } from "../components/GroupCardShell";
import { useSettingsStore } from "@/store";

type AntdToken = ReturnType<typeof theme.useToken>["token"];

/** 圆角档位 */
export type CardRadiusPreset = "none" | "small" | "default" | "large";

/**
 * 圆角档位 → 像素值。
 */
export function useCardRadius(
  preset: CardRadiusPreset = "default",
  token: AntdToken,
): number {
  return useMemo(() => {
    switch (preset) {
      case "none":
        return 0;
      case "small":
        return 4;
      case "large":
        return 16;
      case "default":
      default:
        return token.borderRadiusLG;
    }
  }, [preset, token.borderRadiusLG]);
}

/**
 * DomainGroupCard / TabGroupCard 共享的卡片设置读取。
 *
 * 一次调用替代原来分散的 4 行重复代码：
 *   barPosition = useSettingsStore(domainGroupAccentBarPosition)
 *   radiusPreset = useSettingsStore(domainGroupCardRadius)
 *   { token } = theme.useToken()
 *   cardRadius = useCardRadius(radiusPreset, token)
 */
export function useGroupCardSettings() {
  const barPosition = useSettingsStore(
    (s) => (s.settings.domainGroupAccentBarPosition ?? "left") as GroupCardAccentBarPosition,
  );
  const radiusPreset = useSettingsStore(
    (s) => (s.settings.domainGroupCardRadius ?? "default") as CardRadiusPreset,
  );
  const { token } = theme.useToken();
  const cardRadius = useCardRadius(radiusPreset, token);

  return { barPosition, radiusPreset, cardRadius, token } as const;
}
