/**
 * ShortcutsPanel — 快捷键配置 Tab
 *
 * 包含：
 *   - Chrome 全局快捷键说明（只读，指向 chrome://extensions/shortcuts）
 *   - 页面内快捷键自定义（可录制新快捷键）
 */

import { useState, useCallback, useEffect } from "react";
import { Alert, Button, Flex, Typography } from "antd";
import { RotateCcw } from "lucide-react";

import { ICON_SIZE } from "@/shared/utils/icon-size";
import { useT } from "@/shared/i18n";
import { feedback } from "@/shared/ui/feedback";
import { useSettingsStore } from "@/store";
import { useResolvedKeybindings } from "@/shared/hooks/use-keybinding";
import type { KeybindingAction } from "@/shared/config/keybindings";
import {
  setCustomKeybindings as setRegistryCustom,
} from "@/shared/shortcuts/registry";
import { Field } from "@/features/settings/components/Field";
import { BRAND } from "@/shared/config/brand";

/** Chrome 全局快捷键（只读） */
const GLOBAL_SHORTCUTS = [
  { labelKey: "shortcuts.openCanopy", keys: "Alt + C" },
  { labelKey: "shortcuts.saveAll", keys: "Alt + Shift + S" },
  { labelKey: "shortcuts.toggleSearch", keys: "Alt + K" },
];

/** 视图切换快捷键（只读） */
const VIEW_SHORTCUTS = [
  { labelKey: "shortcuts.view.tabs", keys: "⌘1 / Ctrl+1", description: "标签视图" },
  { labelKey: "shortcuts.view.timeline", keys: "⌘2 / Ctrl+2", description: "时间轴视图" },
  { labelKey: "shortcuts.view.tabgroup", keys: "⌘3 / Ctrl+3", description: "标签组视图" },
  { labelKey: "shortcuts.view.window", keys: "⌘4 / Ctrl+4", description: "窗口视图" },
  { labelKey: "shortcuts.view.kanban", keys: "⌘5 / Ctrl+5", description: "看板视图" },
  { labelKey: "shortcuts.view.frequency", keys: "⌘6 / Ctrl+6", description: "频率视图" },
  { labelKey: "shortcuts.view.archive", keys: "⌘7 / Ctrl+7", description: "归档视图" },
];

/** 键盘导航快捷键（只读） */
const NAVIGATION_SHORTCUTS = [
  { labelKey: "shortcuts.navigation.up", keys: "↑", description: "导航到上一个标签" },
  { labelKey: "shortcuts.navigation.down", keys: "↓", description: "导航到下一个标签" },
  { labelKey: "shortcuts.navigation.select", keys: "Space", description: "勾选/取消勾选标签" },
  { labelKey: "shortcuts.navigation.close", keys: "Delete", description: "关闭选中标签" },
  { labelKey: "shortcuts.navigation.cancel", keys: "Esc", description: "取消选择/关闭弹窗" },
];

/**
 * 快捷键录制器：用户按下组合键后自动识别并显示
 */
function KeybindingRecorder({
  currentKeys,
  onRecord,
  onReset,
}: {
  currentKeys: string;
  onRecord: (keyStr: string) => void;
  onReset: () => void;
}) {
  const { t } = useT();
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    if (!recording) return;

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // 忽略单独的修饰键
      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;

      const parts: string[] = [];
      if (e.metaKey || e.ctrlKey) parts.push("Mod");
      if (e.shiftKey) parts.push("Shift");
      if (e.altKey) parts.push("Alt");

      // 主键映射
      let mainKey = e.key;
      if (mainKey === " ") mainKey = "Space";
      if (mainKey === "Escape") mainKey = "Escape";
      parts.push(mainKey.length === 1 ? mainKey.toLowerCase() : mainKey);

      const keyStr = parts.join("+");
      onRecord(keyStr);
      setRecording(false);
    };

    // Escape 取消录制
    const cancelHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && recording) {
        e.preventDefault();
        e.stopPropagation();
        setRecording(false);
      }
    };

    window.addEventListener("keydown", handler, true);
    window.addEventListener("keydown", cancelHandler, true);
    return () => {
      window.removeEventListener("keydown", handler, true);
      window.removeEventListener("keydown", cancelHandler, true);
    };
  }, [recording, currentKeys, onRecord]);

  const formatDisplay = (key: string) => {
    return key.replace(/Mod/g, "⌘/Ctrl").replace(/\+/g, " + ");
  };

  return (
    <Flex align="center" className="settings-keybinding-recorder">
      <Button
        htmlType="button"
        onClick={() => setRecording(true)}
        aria-label={recording ? t("按下快捷键…") : t("恢复默认")}
        aria-pressed={recording}
        className={`settings-keybinding-trigger${recording ? " is-recording" : ""}`}
      >
        {recording ? t("按下快捷键…") : formatDisplay(currentKeys)}
      </Button>
      <Button
        type="text"
        size="small"
        icon={<RotateCcw size={ICON_SIZE.MEDIUM} />}
        title={t("恢复默认")}
        aria-label={t("恢复默认")}
        onClick={onReset}
        className="settings-keybinding-reset"
      />
    </Flex>
  );
}

export function ShortcutsPanel() {
  const { t } = useT();
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const customKeybindings = useSettingsStore((s) => s.settings.customKeybindings);
  const resolved = useResolvedKeybindings();

  // 初始化时将自定义快捷键同步到 registry
  useEffect(() => {
    if (customKeybindings && Object.keys(customKeybindings).length > 0) {
      setRegistryCustom(customKeybindings);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- 仅初始化时同步一次

  /**
   * 冲突检测：把所有 key 字符串（归一化）映射到 action 列表，
   * 一个 key 对应 >1 个 action 即视为冲突。
   * 同时还检查是否撞上 Chrome 全局快捷键（Alt+C / Alt+Shift+S / Alt+K）。
   */
  const conflictMap = (() => {
    const normalize = (k: string) => k.toLowerCase().replace(/\s+/g, "").replace(/mod/g, "mod");
    const map = new Map<string, KeybindingAction[]>();
    for (const item of resolved) {
      const key = normalize(item.keys);
      const arr = map.get(key) ?? [];
      arr.push(item.action);
      map.set(key, arr);
    }
    const dupByAction = new Map<KeybindingAction, string>();
    for (const [key, actions] of map.entries()) {
      if (actions.length > 1) {
        for (const a of actions) {
          dupByAction.set(
            a,
            t("与 {peers} 冲突", { peers: actions.filter((x) => x !== a).join(", ") }),
          );
        }
      }
      // 与全局快捷键冲突（全局快捷键在 Chrome 中始终生效，无法在页面内覆盖）
      if (key === "alt+k" || key === "alt+c" || key === "alt+shift+s") {
        for (const a of actions) {
          dupByAction.set(a, t("与 Chrome 全局快捷键冲突，可能被全局快捷键拦截"));
        }
      }
    }
    return dupByAction;
  })();

  const handleRecord = useCallback(
    (action: KeybindingAction, keyStr: string) => {
      const updated = { ...customKeybindings, [action]: keyStr };
      void updateSettings({ customKeybindings: updated });
      setRegistryCustom(updated);
      feedback.success(t("快捷键已保存"));
    },
    [customKeybindings, updateSettings, t],
  );

  const handleReset = useCallback(
    (action: KeybindingAction) => {
      const updated = { ...customKeybindings };
      delete updated[action];
      void updateSettings({
        customKeybindings: Object.keys(updated).length > 0 ? updated : undefined,
      });
      setRegistryCustom(Object.keys(updated).length > 0 ? updated : {});
      feedback.success(t("已恢复默认快捷键"));
    },
    [customKeybindings, updateSettings, t],
  );

  return (
    <Flex vertical className="settings-panel-stack">
      {/* 视图切换快捷键（只读） */}
      <section className="settings-section">
        <Field label={t("视图切换")} hint={t("使用数字键 1-7 快速切换不同视图")}>
          <Flex vertical className="settings-card-list">
            {VIEW_SHORTCUTS.map((item) => (
              <Flex
                key={item.labelKey}
                align="center"
                justify="space-between"
                className="settings-card-row"
              >
                <Flex vertical className="settings-card-row__main">
                  <Typography.Text className="settings-card-row__title">
                    {item.description}
                  </Typography.Text>
                </Flex>
                <kbd className="app-kbd">{item.keys}</kbd>
              </Flex>
            ))}
          </Flex>
        </Field>
      </section>

      {/* 键盘导航快捷键（只读） */}
      <section className="settings-section">
        <Field label={t("键盘导航")} hint={t("在标签列表中使用键盘快速操作")}>
          <Flex vertical className="settings-card-list">
            {NAVIGATION_SHORTCUTS.map((item) => (
              <Flex
                key={item.labelKey}
                align="center"
                justify="space-between"
                className="settings-card-row"
              >
                <Flex vertical className="settings-card-row__main">
                  <Typography.Text className="settings-card-row__title">
                    {item.description}
                  </Typography.Text>
                </Flex>
                <kbd className="app-kbd">{item.keys}</kbd>
              </Flex>
            ))}
          </Flex>
        </Field>
      </section>

      {/* Chrome 全局快捷键（只读） */}
      <section className="settings-section">
        <Field label={t("全局快捷键")}>
          <Alert
            type="info"
            title={t("在 chrome://extensions/shortcuts 中自定义快捷键")}
            showIcon
            className="settings-shortcuts-alert"
          />
          <Flex vertical className="settings-card-list">
            {GLOBAL_SHORTCUTS.map((item) => (
              <Flex
                key={item.labelKey}
                align="center"
                justify="space-between"
                className="settings-card-row"
              >
                <Typography.Text className="settings-card-row__title">
                  {t(item.labelKey, { brand: BRAND.name })}
                </Typography.Text>
                <kbd className="app-kbd">{item.keys}</kbd>
              </Flex>
            ))}
          </Flex>
        </Field>
      </section>

      {/* 页面内快捷键（可自定义） */}
      <section className="settings-section">
        <Field
          label={t("页面内快捷键")}
          hint={t("点击快捷键区域即可录制新按键组合；点击重置按钮恢复默认")}
        >
          <Flex vertical className="settings-card-list">
            {resolved.map((item) => (
              <Flex
                key={item.action}
                align="center"
                justify="space-between"
                className="settings-card-row"
              >
                <Flex vertical className="settings-card-row__main">
                  <Typography.Text className="settings-card-row__title">
                    {t(item.label)}
                  </Typography.Text>
                  {item.hint && (
                    <Typography.Text className="settings-card-row__hint">
                      {t(item.hint, { brand: BRAND.name })}
                    </Typography.Text>
                  )}
                  {conflictMap.has(item.action) && (
                    <Typography.Text className="settings-warning-inline">
                      ⚠ {conflictMap.get(item.action)}
                    </Typography.Text>
                  )}
                </Flex>
                <KeybindingRecorder
                  currentKeys={item.keys}
                  onRecord={(keyStr) => handleRecord(item.action, keyStr)}
                  onReset={() => handleReset(item.action)}
                />
              </Flex>
            ))}
          </Flex>
        </Field>
      </section>
    </Flex>
  );
}
