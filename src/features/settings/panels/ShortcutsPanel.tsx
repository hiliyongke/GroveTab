/**
 * ShortcutsPanel — 快捷键说明 Tab
 */

import { Alert, theme } from 'antd';
import { useT } from '@/shared/i18n';
import { Field } from '../components/Field';

export function ShortcutsPanel() {
  const { t } = useT();
  const { token } = theme.useToken();

  const shortcuts = [
    { label: t('shortcuts.openCanopy'), keys: 'Alt + C' },
    { label: t('shortcuts.saveAll'), keys: 'Alt + Shift + S' },
    { label: t('shortcuts.toggleSearch'), keys: 'Alt + K' },
    { label: t('shortcuts.localSearch'), keys: '⌘/Ctrl + K', hint: t('shortcuts.localSearchHint') },
  ];

  return (
    <Field label={t('settings.shortcuts')}>
      <Alert
        type="info"
        message={t('settings.shortcutsHint')}
        showIcon
        style={{ fontSize: 12, marginBottom: 16 }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {shortcuts.map((item) => (
          <div
            key={item.label}
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
              <div style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</div>
              {item.hint && (
                <div style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 2 }}>
                  {item.hint}
                </div>
              )}
            </div>
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
  );
}
