/**
 * ShortcutsPanel — 快捷键配置 Tab
 *
 * 包含：
 *   - Chrome 全局快捷键说明（只读，指向 chrome://extensions/shortcuts）
 *   - 页面内快捷键自定义（可录制新快捷键）
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Alert, theme, Button, App } from 'antd';
import { UndoOutlined } from '@ant-design/icons';
import { useT } from '@/shared/i18n';
import { useSettingsStore } from '@/store';
import { useResolvedKeybindings } from '@/shared/hooks/use-keybinding';
import type { KeybindingAction } from '@/shared/config/keybindings';
import { Field } from '../components/Field';

/** Chrome 全局快捷键（只读） */
const GLOBAL_SHORTCUTS = [
  { labelKey: 'shortcuts.openCanopy', keys: 'Alt + C' },
  { labelKey: 'shortcuts.saveAll', keys: 'Alt + Shift + S' },
  { labelKey: 'shortcuts.toggleSearch', keys: 'Alt + K' },
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
  const { token } = theme.useToken();
  const [recording, setRecording] = useState(false);
  const [displayText, setDisplayText] = useState(currentKeys);
  const ref = useRef<HTMLDivElement>(null);

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
      setDisplayText(keyStr);
      onRecord(keyStr);
      setRecording(false);
    };

    // Escape 取消录制
    const cancelHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && recording) {
        e.preventDefault();
        e.stopPropagation();
        setRecording(false);
        setDisplayText(currentKeys);
      }
    };

    window.addEventListener('keydown', handler, true);
    window.addEventListener('keydown', cancelHandler, true);
    return () => {
      window.removeEventListener('keydown', handler, true);
      window.removeEventListener('keydown', cancelHandler, true);
    };
  }, [recording, currentKeys, onRecord]);

  useEffect(() => {
    if (!recording) {
      setDisplayText(currentKeys);
    }
  }, [currentKeys, recording]);

  const formatDisplay = (key: string) => {
    return key
      .replace(/Mod/g, '⌘/Ctrl')
      .replace(/\+/g, ' + ');
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div
        ref={ref}
        onClick={() => setRecording(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 80,
          padding: '4px 10px',
          fontSize: 12,
          fontFamily: 'inherit',
          borderRadius: token.borderRadiusSM,
          background: recording ? token.colorPrimaryBg : token.colorBgContainer,
          border: `1px solid ${recording ? token.colorPrimary : token.colorBorder}`,
          color: recording ? token.colorPrimary : token.colorTextSecondary,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'all 160ms ease',
        }}
      >
        {recording ? t('shortcuts.recording') : formatDisplay(displayText)}
      </div>
      <Button
        type="text"
        size="small"
        icon={<UndoOutlined />}
        title={t('shortcuts.resetHint')}
        onClick={onReset}
        style={{ color: token.colorTextTertiary }}
      />
    </div>
  );
}

export function ShortcutsPanel() {
  const { t } = useT();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const customKeybindings = useSettingsStore((s) => s.settings.customKeybindings);
  const resolved = useResolvedKeybindings();

  const handleRecord = useCallback((action: KeybindingAction, keyStr: string) => {
    const updated = { ...customKeybindings, [action]: keyStr };
    void updateSettings({ customKeybindings: updated });
    message.success(t('shortcuts.saved'));
  }, [customKeybindings, updateSettings, message, t]);

  const handleReset = useCallback((action: KeybindingAction) => {
    const updated = { ...customKeybindings };
    delete updated[action];
    void updateSettings({ customKeybindings: Object.keys(updated).length > 0 ? updated : undefined });
    message.success(t('shortcuts.reset'));
  }, [customKeybindings, updateSettings, message, t]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Chrome 全局快捷键（只读） */}
      <Field label={t('settings.globalShortcuts')}>
        <Alert
          type="info"
          message={t('settings.shortcutsHint')}
          showIcon
          style={{ fontSize: 12, marginBottom: 16 }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {GLOBAL_SHORTCUTS.map((item) => (
            <div
              key={item.labelKey}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: token.borderRadiusLG,
                background: token.colorFillQuaternary,
                border: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 500 }}>{t(item.labelKey)}</span>
              <kbd
                style={{
                  fontSize: 12,
                  fontFamily: 'inherit',
                  padding: '3px 8px',
                  borderRadius: token.borderRadiusSM,
                  background: token.colorBgContainer,
                  border: `1px solid ${token.colorBorder}`,
                  color: token.colorTextSecondary,
                  whiteSpace: 'nowrap',
                }}
              >
                {item.keys}
              </kbd>
            </div>
          ))}
        </div>
      </Field>

      {/* 页面内快捷键（可自定义） */}
      <Field label={t('settings.localShortcuts')} hint={t('settings.localShortcutsHint')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {resolved.map((item) => (
              <div
                key={item.action}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: token.borderRadiusLG,
                  background: token.colorFillQuaternary,
                  border: `1px solid ${token.colorBorderSecondary}`,
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{t(item.label)}</div>
                  {item.hint && (
                    <div style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 2 }}>
                      {t(item.hint)}
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
    </div>
  );
}
