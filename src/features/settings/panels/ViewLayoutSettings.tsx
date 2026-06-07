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

import { useMemo, useCallback } from "react";
import { Select, Segmented, Switch, Flex, Button, theme } from "antd";
import { ArrowUp, ArrowDown, EyeOff } from "lucide-react";

import type { UserSettings, ViewTabPosition } from "@/shared/types";

import { useT } from "@/shared/i18n";
import { VIEW_CONFIGS } from "@/shared/config/views";
import { Field } from "@/features/settings/components/Field";
import { ICON_SIZE } from "@/shared/utils/icon-size";

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
      <Field label={t("默认视图")}>
        <Select
          value={settings.defaultView}
          onChange={(value) => handleSetting({ defaultView: value })}
          className="settings-control-full"
          options={defaultViewOptions}
        />
      </Field>

      {settings.defaultView === "tabs" && (
        <Field label={t("标签页布局")} hint={t("切换标签页主视图的具体呈现方式")}>
          <Segmented
            block
            value={settings.tabsLayout ?? "masonry"}
            onChange={(value) =>
              handleSetting({ tabsLayout: value as "masonry" | "compact" | "grid" })
            }
            options={[
              { value: "masonry", label: t("域名分组") },
              { value: "compact", label: t("紧凑") },
              { value: "grid", label: t("网格") },
            ]}
          />
        </Field>
      )}

      <Field
        label={t("视图标签位置")}
        hint={t("视图切换标签的排列方式：左侧/右侧垂直侧栏")}
      >
        <Segmented
          block
          value={settings.viewTabPosition ?? "right"}
          onChange={(value) => handleSetting({ viewTabPosition: value as ViewTabPosition })}
          options={[
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

      <Field
        label={t("显示历史记录")}
        hint={t("开启后在视图切换栏中显示历史记录入口；默认仅通过快捷键或全局搜索访问")}
      >
        <Switch
          checked={settings.historyTabVisible === true}
          onChange={(value) => handleSetting({ historyTabVisible: value })}
        />
      </Field>

      {/* P2-03: TabBar 自定义排序 */}
      <TabBarOrderEditor settings={settings} updateSettings={updateSettings} />
    </Flex>
  );
}

/** P2-03: TabBar 视图排序与显隐编辑器 */
function TabBarOrderEditor({ settings, updateSettings }: {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void | Promise<void>;
}) {
  const { t } = useT();
  const { token } = theme.useToken();
  const order = settings.tabBarOrder ?? [];
  const hidden = settings.hiddenTabBarViews ?? [];

  const handleSetting = (patch: Partial<UserSettings>) => { void updateSettings(patch); };

  // 当前 TabBar 可见的 primary 视图
  const visibleViews = useMemo(
    () => VIEW_CONFIGS.filter((v) => v.primary !== false && v.id !== "archive" && v.id !== "trash"),
    [],
  );

  // 排序后视图列表
  const ordered = useMemo(() => {
    const list = [...visibleViews];
    if (order.length > 0) {
      const orderMap = new Map(order.map((id, i) => [id, i]));
      list.sort((a, b) => (orderMap.get(a.id) ?? 99) - (orderMap.get(b.id) ?? 99));
    }
    return list;
  }, [visibleViews, order]);

  const moveUp = useCallback((index: number) => {
    if (index <= 0) return;
    const newOrder = [...ordered.map((v) => v.id)];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index]!, newOrder[index - 1]!];
    handleSetting({ tabBarOrder: newOrder });
  }, [ordered, handleSetting]);

  const moveDown = useCallback((index: number) => {
    if (index >= ordered.length - 1) return;
    const newOrder = [...ordered.map((v) => v.id)];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1]!, newOrder[index]!];
    handleSetting({ tabBarOrder: newOrder });
  }, [ordered, handleSetting]);

  const toggleHidden = useCallback((viewId: string) => {
    const newHidden = hidden.includes(viewId)
      ? hidden.filter((id) => id !== viewId)
      : [...hidden, viewId];
    handleSetting({ hiddenTabBarViews: newHidden });
  }, [hidden, handleSetting]);

  return (
    <Field label={t("视图栏排序")} hint={t("拖拽排序或隐藏不常用的视图；至少保留一个可见视图。")}>
      <Flex vertical gap={4}>
        {ordered.map((view, index) => {
          const isHidden = hidden.includes(view.id);
          return (
            <Flex
              key={view.id}
              align="center"
              justify="space-between"
              style={{
                padding: "4px 8px",
                borderRadius: token.borderRadiusSM,
                backgroundColor: token.colorFillTertiary,
                opacity: isHidden ? 0.5 : 1,
              }}
            >
              <span style={{ flex: 1 }}>{t(view.labelKey)}</span>
              <Flex gap={2}>
                <Button
                  type="text"
                  size="small"
                  icon={<ArrowUp size={ICON_SIZE.SMALL} />}
                  disabled={index === 0}
                  onClick={() => moveUp(index)}
                />
                <Button
                  type="text"
                  size="small"
                  icon={<ArrowDown size={ICON_SIZE.SMALL} />}
                  disabled={index === ordered.length - 1}
                  onClick={() => moveDown(index)}
                />
                <Button
                  type="text"
                  size="small"
                  icon={<EyeOff size={ICON_SIZE.SMALL} />}
                  danger={isHidden}
                  onClick={() => toggleHidden(view.id)}
                  disabled={hidden.length >= ordered.length - 1 && !isHidden}
                  title={isHidden ? t("显示") : t("隐藏")}
                />
              </Flex>
            </Flex>
          );
        })}
      </Flex>
    </Field>
  );
}
