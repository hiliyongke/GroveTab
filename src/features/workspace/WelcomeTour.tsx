/**
 * WelcomeTour — 首次使用的多步高亮引导
 *
 * 用 antd Tour 替代静态的视图卡片弹窗：聚焦三个最高频入口
 *   1. 搜索框（⌘K）—— 一站式搜索标签 / 书签 / 历史 / 热榜
 *   2. 视图切换 —— 标签 / 书签 / 会话归档 / 热榜 / 工具
 *   3. 命令面板（⌘P）—— 快速执行任意操作
 *
 * 目标元素通过稳定的 `data-tour` 属性定位；元素不存在时（对应 UI 被隐藏）
 * 该步自动降级为居中信息卡，不会报错。
 */

import { useMemo } from "react";
import { Tour, type TourProps } from "antd";
import { useT } from "@/shared/i18n";
import { getBrandDisplayName } from "@/shared/config/brand";

interface WelcomeTourProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 按 data-tour 属性获取锚点元素的 target getter。
 * 元素不存在时返回 null，antd Tour 会把该步降级为居中信息卡。
 * （antd 的 target 类型未直接表达 `() => HTMLElement | null` 联合，故此处统一断言。）
 */
function anchorTarget(name: string): () => HTMLElement {
  return (() => document.querySelector<HTMLElement>(`[data-tour="${name}"]`)) as () => HTMLElement;
}

export function WelcomeTour({ open, onClose }: WelcomeTourProps) {
  const { t, locale } = useT();
  const brandName = getBrandDisplayName(locale);

  const steps = useMemo<TourProps["steps"]>(
    () => [
      {
        title: t("欢迎使用 {brand}", { brand: brandName }),
        description: t(
          "30 秒带你认识 3 个最常用的入口。随时可以点「跳过」，之后也能在「设置 → 系统 → 重播欢迎教程」里再看一遍。",
        ),
        // 无 target → 居中欢迎卡
      },
      {
        title: t("一处搜索，全部命中"),
        description: t("按 ⌘K 唤起搜索，跨标签页、书签、历史、热榜一次搜清。"),
        target: anchorTarget("search"),
      },
      {
        title: t("在这里切换视图"),
        description: t("标签、书签、会话归档、热榜、开发工具——常用视图都在这条切换栏。"),
        target: anchorTarget("view-tabs"),
      },
      {
        title: t("命令面板：键盘流神器"),
        description: t("按 ⌘P 打开命令面板，不用找菜单，直接输入即可执行任意操作。"),
        // 命令面板为按需唤起的浮层，此处用居中信息卡引导快捷键
      },
    ],
    [t, brandName],
  );

  return (
    <Tour
      open={open}
      onClose={onClose}
      onFinish={onClose}
      steps={steps}
      // 关闭/完成均视为引导结束
    />
  );
}
