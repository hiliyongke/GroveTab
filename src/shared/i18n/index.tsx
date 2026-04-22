/**
 * Canopy i18n — Lightweight runtime i18n for Chrome Extension
 */

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useSettingsStore } from '@/store';
import zhCN from './zh-CN';
import en from './en';

type Locale = 'zh-CN' | 'en';
const dictionaries: Record<Locale, Record<string, string>> = { 'zh-CN': zhCN, en };

interface I18nContextValue {
  locale: Locale;
  t: (key: string, params?: Record<string, string | number>) => string;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const settingsLocale = useSettingsStore((s) => s.settings.language);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const loaded = useSettingsStore((s) => s.loaded);

  const [locale, setLocaleInternal] = useState<Locale>(() => {
    const nav = navigator.language;
    return nav.startsWith('zh') ? 'zh-CN' : 'en';
  });

  // Sync with settings when loaded
  useEffect(() => {
    if (loaded && settingsLocale) {
      setLocaleInternal(settingsLocale);
    }
  }, [loaded, settingsLocale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleInternal(newLocale);
    updateSettings({ language: newLocale });
  }, [updateSettings]);

  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    let text = dictionaries[locale]?.[key] || dictionaries['en']?.[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT must be used within I18nProvider');
  return ctx;
}

/** Format date with Intl.DateTimeFormat */
export function formatDate(date: Date | number, locale?: string): string {
  return new Intl.DateTimeFormat(locale || 'zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/** Format number with Intl.NumberFormat */
export function formatNumber(num: number, locale?: string): string {
  return new Intl.NumberFormat(locale || 'zh-CN').format(num);
}
