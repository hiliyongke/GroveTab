/**
 * ThemeToggle — Cycle through light/dark/system themes
 */

import { Sun, Moon, Monitor } from 'lucide-react';
import { useSettingsStore } from '@/store';
import { useT } from '@/shared/i18n';

type Theme = 'light' | 'dark' | 'system';
const THEME_CYCLE: Theme[] = ['light', 'dark', 'system'];
const THEME_ICONS: Record<Theme, React.ReactNode> = {
  light: <Sun className="w-4 h-4" />,
  dark: <Moon className="w-4 h-4" />,
  system: <Monitor className="w-4 h-4" />,
};

function applyTheme(t: Theme) {
  if (t === 'system') {
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', systemDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', t);
  }
}

export function ThemeToggle() {
  const theme = useSettingsStore((s) => s.settings.theme);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const { t } = useT();

  const cycleTheme = () => {
    const currentIndex = THEME_CYCLE.indexOf(theme);
    const nextTheme = THEME_CYCLE[(currentIndex + 1) % THEME_CYCLE.length];
    updateSettings({ theme: nextTheme });
    applyTheme(nextTheme);
  };

  return (
    <button
      onClick={cycleTheme}
      className="w-9 h-9 flex items-center justify-center rounded-[var(--radius-md)]
        bg-surface hover:bg-surface-hover border border-border
        text-text-secondary hover:text-text
        transition-colors duration-150 cursor-pointer"
      aria-label={t('theme.toggle')}
      title={t(`theme.${theme}` as const)}
    >
      {THEME_ICONS[theme]}
    </button>
  );
}
