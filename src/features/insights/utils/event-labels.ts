/**
 * insights/utils/event-labels.ts — 事件名归一化与本地化
 */

import { translate } from "@/shared/i18n/core";
import { useT } from "@/shared/i18n";

/**
 * 旧 `newtabOpens` 合并到 `newtab_open`，避免 Top 列表里出现两条 label 相同但 event 不同的重复项。
 */
export function normalizeEvent(event: string): string {
  if (event === "newtabOpens") return "newtab_open";
  return event;
}

/** 模块级场景：模块初始化时翻译 */
export function getEventLabelStatic(event: string): string {
  const norm = normalizeEvent(event);
  const i18nKey = `insights.event.${norm}`;
  const label = translate(i18nKey);
  return label === i18nKey ? norm : label;
}

/** React 组件场景：使用 hook 拿 t */
export function useEventLabel(): (event: string) => string {
  const { t } = useT();
  return (event: string) => {
    const norm = normalizeEvent(event);
    const i18nKey = `insights.event.${norm}`;
    const label = t(i18nKey);
    return label === i18nKey ? norm : label;
  };
}
