/**
 * IconRenderer — 动态加载 lucide-react 图标
 *
 * 接收 iconName 字符串，运行时动态 import("lucide-react") 获取对应图标组件。
 * 避免在 views.ts 中静态导入全部 lucide 图标导致整个包打进 chunk。
 */

import { useState, useEffect, memo } from "react";
import type { LucideIcon } from "lucide-react";
import type { LucideIconName } from "@/shared/config/views";

interface IconRendererProps {
  name: LucideIconName;
  size?: number;
}

export const IconRenderer = memo(function IconRenderer({ name, size = 15 }: IconRendererProps) {
  const [Icon, setIcon] = useState<LucideIcon | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("lucide-react").then((mod) => {
      const comp = (mod as Record<string, unknown>)[name] as LucideIcon | undefined;
      if (!cancelled && comp) setIcon(() => comp);
    });
    return () => {
      cancelled = true;
    };
  }, [name]);

  if (!Icon) {
    return <span style={{ display: "inline-block", width: size, height: size }} aria-hidden />;
  }

  return <Icon size={size} />;
});
