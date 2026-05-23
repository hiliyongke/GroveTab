/**
 * ShortcutsPanel — 快捷键配置 Tab
 *
 * 包含：
 *   - Chrome 全局快捷键说明（只读，指向 chrome://extensions/shortcuts）
 *   - 页面内快捷键自定义（可录制新快捷键）
 */

import { useState, useCallback, useEffect } from 'react';
import { Alert, Button, App } from 'antd';
import { RotateCcw } from 'lucide-react';

import { ICON_SIZE } from '@/shared/utils/icon-size';
import { useT } from '@/shared/i18n';
import { useSettingsStore } from '@/store';
import { useResolvedKeybindings } from '@/shared/hooks/use-keybinding';
import type { KeybindingAction } from '@/shared/config/keybindings';
import { Field } from '@/features/settings/components/Field';
import { BRAND } from '@/shared/config/brand';
import styles from '../settings.module.less';

/** Chrome 全局快捷键（只读） */
const GLOBAL_SHORTCUTS = [
  { labelKey: 'shortcuts.openCanopy', keys: 'Alt + C' },
  { labelKey: 'shortcuts.saveAll', keys: 'Alt + Shift + S' },
  { labelKey: 'shortcuts.toggleSearch', keys: 'Alt + K' },
];

/**
 * 快捷键录制器
 *
 * 用户按下组合键后自动识别并显示。
 *
 * @param props - 组件属性
 * @param props.currentKeys - 当前已按下的键（用于显示）
 * @param props.onRecord - 录制完成回调（返回标准化快捷键字符串）
 * @param props.onReset - 重置录制回调
 * @returns 快捷键录制器 JSX 元素
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
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

      const parts: string[] = [];
      if (e.metaKey || e.ctrlKey) parts.push('Mod');
      if (e.shiftKey) parts.push('Shift');
      if (e.altKey) parts.push('Alt');

      // 主键映射
      let mainKey = e.key;
      if (mainKey === ' ') mainKey = 'Space';
      if (mainKey === 'Escape') mainKey = 'Escape';
      parts.push(mainKey.length === 1 ? mainKey.toLowerCase() : mainKey);

      const keyStr = parts.join('+');
      onRecord(keyStr);
      setRecording(false);
    };

    // Escape 取消录制
    const cancelHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && recording) {
        e.preventDefault();
        e.stopPropagation();
        setRecording(false);
      }
    };

    window.addEventListener('keydown', handler, true);
    window.addEventListener('keydown', cancelHandler, true);
    return () => {
      window.removeEventListener('keydown', handler, true);
      window.removeEventListener('keydown', cancelHandler, true);
    };
  }, [recording, currentKeys, onRecord]);

  /**
   * 格式化快捷键显示文本
   *
   * 将快捷键字符串中的 Mod 替换为 ⌘/Ctrl，+ 替换为 + 。
   *
   * @param key - 快捷键字符串（如 "Mod+Shift+K"）
   * @returns 格式化后的快捷键显示文本（如 "⌘/Ctrl + Shift + K"）
   */
  const formatDisplay = (key: string) => {
    return key
      .replace(/Mod/g, '⌘/Ctrl')
      .replace(/\+/g, ' + ');
  };

  return (
    <div className={styles['settings-keybinding-recorder']}>
      <button
        type="button"
        onClick={() => setRecording(true)}
        aria-label={
          recording ? t('shortcuts.recording') : t('shortcuts.resetHint')
        }
        aria-pressed={recording}
        className={`${styles['settings-keybinding-trigger']}${recording ? ` ${styles['settings-keybinding-trigger--recording']}` : ''}`}
      >
        {recording ? t('shortcuts.recording') : formatDisplay(currentKeys)}
      </button>
      <Button
        type="text"
        size="small"
        icon={<RotateCcw size={ICON_SIZE.MEDIUM} />}
        title={t('shortcuts.resetHint')}
        aria-label={t('shortcuts.resetHint')}
        onClick={onReset}
        className={styles['settings-keybinding-reset']}
      />
    </div>
  );
}

/**
 * 快捷键配置面板主组件
 *
 * 包含 Chrome 全局快捷键说明和页面内快捷键自定义。
 * 支持快捷键录制、重置和冲突检测。
 *
 * @returns 快捷键配置面板 JSX 元素
 */
export function ShortcutsPanel() {
  const { t } = useT();
  const { message } = App.useApp();
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const customKeybindings = useSettingsStore((s) => s.settings.customKeybindings);
  const resolved = useResolvedKeybindings();

  /**
   * 冲突检测：把所有 key 字符串（归一化）映射到 action 列表，
   * 一个 key 对应 >1 个 action 即视为冲突。
   * 同时还检查是否撞上 Chrome 全局快捷键（Alt+C / Alt+Shift+S / Alt+K）。
   */
  const conflictMap = (() => {
    const normalize = (k: string) => k.toLowerCase().replace(/\s+/g, '').replace(/mod/g, 'mod');
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
          dupByAction.set(a, t('shortcuts.conflict', { peers: actions.filter((x) => x !== a).join(', ') }));
        }
      }
      // 与全局快捷键冲突（全局快捷键在 Chrome 中始终生效，无法在页面内覆盖）
      if (key === 'alt+k' || key === 'alt+c' || key === 'alt+shift+s') {
        for (const a of actions) {
          dupByAction.set(a, t('shortcuts.globalConflict'));
        }
      }
    }
    return dupByAction;
  })();

  /**
   * 处理快捷键录制完成
   *
   * 更新指定动作的快捷键绑定并保存设置。
   *
   * @param action - 快捷键动作标识
   * @param keyStr - 录制的快捷键字符串
   * @returns 无返回值
   */
  const handleRecord = useCallback((action: KeybindingAction, keyStr: string) => {
    const updated = { ...customKeybindings, [action]: keyStr };
    void updateSettings({ customKeybindings: updated });
    message.success(t('shortcuts.saved'));
  }, [customKeybindings, updateSettings, message, t]);

  /**
   * 重置快捷键到默认状态
   *
   * 删除指定动作的自定义快捷键绑定，恢复默认设置。
   *
   * @param action - 快捷键动作标识
   * @returns 无返回值
   */
  const handleReset = useCallback((action: KeybindingAction) => {
    const updated = { ...customKeybindings };
    delete updated[action];
    void updateSettings({ customKeybindings: Object.keys(updated).length > 0 ? updated : undefined });
    message.success(t('shortcuts.reset'));
  }, [customKeybindings, updateSettings, message, t]);

  return (
    <div className={styles['settings-panel-stack']}>
      {/* Chrome 全局快捷键（只读） */}
      <section className={styles['settings-section']}>
        <Field label={t('settings.globalShortcuts')}>
        <Alert
          type="info"
          message={t('settings.shortcutsHint')}
          showIcon
          className={styles['settings-shortcuts-alert']}
        />
        <div className={styles['settings-card-list']}>
          {GLOBAL_SHORTCUTS.map((item) => (
            <div key={item.labelKey} className={styles['settings-card-row']}>
              <span className={styles['settings-card-row__title']}>{t(item.labelKey, { brand: BRAND.name })}</span>
              <kbd className="app-kbd">{item.keys}</kbd>
            </div>
          ))}
        </div>
      </Field>
      </section>

      {/* 页面内快捷键（可自定义） */}
      <section className={styles['settings-section']}>
      <Field label={t('settings.localShortcuts')} hint={t('settings.localShortcutsHint')}>
        <div className={styles['settings-card-list']}>
          {resolved.map((item) => (
            <div key={item.action} className={styles['settings-card-row']}>
              <div className={styles['settings-card-row__main']}>
                <div className={styles['settings-card-row__title']}>{t(item.label)}</div>
                  {item.hint && (
                    <div className={styles['settings-card-row__hint']}>
                      {t(item.hint, { brand: BRAND.name })}
                    </div>
                  )}
                  {conflictMap.has(item.action) && (
                    <div className={styles['settings-warning-inline']}>
                      ⚠ {conflictMap.get(item.action)}
                    </div>
                  )}
              </div>
              <KeybindingRecorder
                currentKeys={item.keys}
                onRecord={(keyStr) => handleRecord(item.action, keyStr)}
                onReset={() => handleReset(item.action)}
              />
            </div>
            ))}
        </div>
      </Field>
      </section>
    </div>
  );
}
