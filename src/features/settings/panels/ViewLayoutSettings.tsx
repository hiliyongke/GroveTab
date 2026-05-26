/**
 * ViewLayoutSettings —— 视图与布局设置组件
 *
 * 包含：
 * 1. 默认视图选择
 * 2. 域名分组列数
 * 3. 域名分组显示 favicon 开关
 * 4. 域名分组强调条位置
 * 5. 域名分组卡片圆角
 * 6. 域名分组排序方式
 * 7. 网格视图展开触发方式（点击 / 悬停）
 */

import { useMemo } from "react";
import { Select, Segmented, Switch, Flex } from "antd";

import type { NewtabPageMode, UserSettings, ViewTabPosition } from "@/shared/types";

type WindowCardDefaultCollapsed = "current-only" | "all-expanded" | "all-collapsed";
import { useT } from "@/shared/i18n";
import { VIEW_CONFIGS } from "@/shared/config/views";
import { Field } from "@/features/settings/components/Field";

interface ViewLayoutSettingsProps {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void | Promise<void>;
}

/**
 * 视图与布局设置组件
 */
export function ViewLayoutSettings({ settings, updateSettings }: ViewLayoutSettingsProps) {
  const { t } = useT();

  /** 防 ESLint `no-misused-promises`：`updateSettings` 异步但表单回调需要 `void`。 */
  const handleSetting = (patch: Partial<UserSettings>) => {
    void updateSettings(patch);
  };

  /** 默认视图下拉选项，缓存以避免每次渲染重建数组 */
  const defaultViewOptions = useMemo(
    () =>
      VIEW_CONFIGS.map((view) => ({
        value: view.id,
        label: t(view.labelKey),
      })),
    [t],
  );

  return (
    <Flex vertical className="settings-panel-stack settings-panel-stack--regular">
      <Field
        label={t("默认空间")}
        hint={t("工作台用于整理标签页；热榜查看全网热点；开发工具栏提供常用开发工具。")}
      >
        <Segmented
          block
          value={settings.newtabPageMode ?? "workspace"}
          onChange={(value) => handleSetting({ newtabPageMode: value as NewtabPageMode })}
          options={[
            { value: "workspace", label: t("工作台") },
            { value: "trending", label: t("热榜") },
            { value: "devtools", label: t("开发工具栏") },
          ]}
        />
      </Field>

      <Field label={t("默认视图")}>
        <Select
          value={settings.defaultView}
          onChange={(value) => handleSetting({ defaultView: value })}
          className="settings-control-full"
          options={defaultViewOptions}
        />
      </Field>

      <Field
        label={t("视图标签位置")}
        hint={t("视图切换标签的排列方式：顶部/底部水平，左侧/右侧垂直侧栏")}
      >
        <Segmented
          block
          value={settings.viewTabPosition ?? "top"}
          onChange={(value) => handleSetting({ viewTabPosition: value as ViewTabPosition })}
          options={[
            { value: "top", label: t("顶部") },
            { value: "bottom", label: t("底部") },
            { value: "left", label: t("左侧") },
            { value: "right", label: t("右侧") },
          ]}
        />
      </Field>

      <Field label={t("域名分组列数")} hint={t("自动：随窗口宽度自适应；或手动锁定列数")}>
        <Segmented
          block
          value={String(settings.domainGroupColumns ?? "auto")}
          onChange={(value) =>
            handleSetting({
              domainGroupColumns:
                value === "auto" ? "auto" : (Number(value) as 1 | 2 | 3 | 4 | 5 | 6),
            })
          }
          options={[
            { value: "auto", label: t("自动") },
            { value: "1", label: "1" },
            { value: "2", label: "2" },
            { value: "3", label: "3" },
            { value: "4", label: "4" },
            { value: "5", label: "5" },
            { value: "6", label: "6" },
          ]}
        />
      </Field>

      <Field label={t("窗口卡片列数")} hint={t("自动：按 360px 卡片宽度自适应；或手动锁定列数")}>
        <Segmented
          block
          value={String(settings.windowCardColumns ?? "auto")}
          onChange={(value) =>
            handleSetting({
              windowCardColumns:
                value === "auto" ? "auto" : (Number(value) as 1 | 2 | 3 | 4 | 5 | 6),
            })
          }
          options={[
            { value: "auto", label: t("自动") },
            { value: "1", label: "1" },
            { value: "2", label: "2" },
            { value: "3", label: "3" },
            { value: "4", label: "4" },
            { value: "5", label: "5" },
            { value: "6", label: "6" },
          ]}
        />
      </Field>

      <Field label={t("窗口卡片默认展开")} hint={t("进入窗口视图时默认展开哪些窗口卡片")}>
        <Segmented
          block
          value={settings.windowCardDefaultCollapsed ?? "current-only"}
          onChange={(value) =>
            handleSetting({
              windowCardDefaultCollapsed: value as WindowCardDefaultCollapsed,
            })
          }
          options={[
            { value: "current-only", label: t("仅当前窗口") },
            { value: "all-expanded", label: t("全部展开") },
            { value: "all-collapsed", label: t("全部折叠") },
          ]}
        />
      </Field>

      <Field
        label={t("显示标签组区块")}
        hint={t("在窗口卡片内展示 Chrome 原生标签组；关闭后退化为普通标签列表")}
      >
        <Switch
          checked={settings.windowCardShowGroupSection ?? true}
          onChange={(value) => handleSetting({ windowCardShowGroupSection: value })}
        />
      </Field>

      <Field
        label={t("显示拖拽占位区")}
        hint={t('在窗口/分组末尾显示"拖到此处"的幽灵落点，便于新建分组或追加标签')}
      >
        <Switch
          checked={settings.windowCardShowGhostDropZone ?? true}
          onChange={(value) => handleSetting({ windowCardShowGhostDropZone: value })}
        />
      </Field>

      <Field label={t("窗口色条位置")} hint={t("窗口卡片的身份色条位置，与域名分组卡片保持一致")}>
        <Segmented
          block
          value={settings.windowCardAccentBarPosition ?? "left"}
          onChange={(value) =>
            handleSetting({
              windowCardAccentBarPosition: value as "left" | "top" | "none",
            })
          }
          options={[
            { value: "left", label: t("左侧") },
            { value: "top", label: t("顶部") },
            { value: "none", label: t("隐藏") },
          ]}
        />
      </Field>

      <Field
        label={t("子项显示域名图标")}
        hint={t("关闭后分组内每条标签不再显示 favicon，视觉更紧凑；顶部卡片依旧保留域名图标")}
      >
        <Switch
          checked={settings.domainGroupShowItemFavicon ?? true}
          onChange={(value) => handleSetting({ domainGroupShowItemFavicon: value })}
        />
      </Field>

      <Field
        label={t("域名色条位置")}
        hint={t("每个域名卡片会显示一条代表身份的纯色条，选一个你喜欢的位置")}
      >
        <Segmented
          block
          value={settings.domainGroupAccentBarPosition ?? "left"}
          onChange={(value) =>
            handleSetting({
              domainGroupAccentBarPosition: value as "left" | "top" | "none",
            })
          }
          options={[
            { value: "left", label: t("左侧") },
            { value: "top", label: t("顶部") },
            { value: "none", label: t("隐藏") },
          ]}
        />
      </Field>

      <Field label={t("卡片圆角")} hint={t("调整域名分组卡片的圆角大小——直角更硬朗、大圆角更柔和")}>
        <Segmented
          block
          value={settings.domainGroupCardRadius ?? "default"}
          onChange={(value) =>
            handleSetting({
              domainGroupCardRadius: value as "none" | "small" | "default" | "large",
            })
          }
          options={[
            { value: "none", label: t("直角") },
            { value: "small", label: t("小") },
            { value: "default", label: t("默认") },
            { value: "large", label: t("大") },
          ]}
        />
      </Field>

      <Field label={t("分组排序方式")} hint={t("选择域名分组的排序规则；固定标签所在分组始终优先")}>
        <Segmented
          block
          value={settings.domainGroupSortBy ?? "tabCount"}
          onChange={(value) =>
            handleSetting({
              domainGroupSortBy: value as "tabCount" | "alphabetical" | "recentAccess",
            })
          }
          options={[
            { value: "tabCount", label: t("标签数量") },
            { value: "alphabetical", label: t("域名拼音") },
            { value: "recentAccess", label: t("最近访问") },
          ]}
        />
      </Field>

      <Field
        label={t("网格卡片展开方式")}
        hint={t("多 tab 卡片何时弹出列表浮层——点击更稳重，悬停更轻快；仅影响网格视图")}
      >
        <Segmented
          block
          value={settings.gridExpandTrigger ?? "click"}
          onChange={(value) =>
            handleSetting({
              gridExpandTrigger: value as "click" | "hover",
            })
          }
          options={[
            { value: "click", label: t("点击") },
            { value: "hover", label: t("悬停") },
          ]}
        />
      </Field>
    </Flex>
  );
}
