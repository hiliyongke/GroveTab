/**
 * GradientPicker — Select gradient preset or custom two-color gradient
 */

import { useSettingsStore } from '@/store';
import { useT } from '@/shared/i18n';

const PRESETS = [
  { id: 'aurora', label: 'Aurora', colors: ['#F5F7FA', '#E0C3FC', '#8EC5FC'] },
  { id: 'sunrise', label: 'Sunrise', colors: ['#FEE140', '#FA709A'] },
  { id: 'deepspace', label: 'Deep Space', colors: ['#0F2027', '#203A43', '#2C5364'] },
];

export function GradientPicker() {
  const gradientPreset = useSettingsStore((s) => s.settings.gradientPreset);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const { t } = useT();

  const handleCustomColor1 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color1 = e.target.value;
    const current = useSettingsStore.getState().settings.customGradient;
    updateSettings({
      gradientPreset: 'custom',
      customGradient: current
        ? current.replace(/^linear-gradient\([^,]+,\s*[^,]+/, `linear-gradient(135deg, ${color1}`)
        : `linear-gradient(135deg, ${color1}, #8EC5FC)`,
    });
  };

  const handleCustomColor2 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color2 = e.target.value;
    const current = useSettingsStore.getState().settings.customGradient;
    updateSettings({
      gradientPreset: 'custom',
      customGradient: current
        ? current.replace(/,\s*[^)]+\)/, `, ${color2})`)
        : `linear-gradient(135deg, #F5F7FA, ${color2})`,
    });
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <h3 className="text-sm font-medium text-text">{t('gradient.title')}</h3>
      <div className="flex gap-3">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => updateSettings({ gradientPreset: preset.id as 'aurora' | 'sunrise' | 'deepspace' | 'custom' })}
            className={`w-16 h-16 rounded-[var(--radius-md)] border-2 transition-all duration-150 cursor-pointer ${
              gradientPreset === preset.id ? 'border-focus-ring scale-105' : 'border-border hover:border-text-muted'
            }`}
            style={{
              background: `linear-gradient(135deg, ${preset.colors.join(', ')})`,
            }}
            aria-label={t(`gradient.${preset.id}` as 'gradient.aurora' | 'gradient.sunrise' | 'gradient.deepspace')}
            title={preset.label}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-muted">{t('gradient.custom')}</span>
        <input
          type="color"
          className="w-8 h-8 rounded cursor-pointer border-0"
          onChange={handleCustomColor1}
        />
        <input
          type="color"
          className="w-8 h-8 rounded cursor-pointer border-0"
          defaultValue="#8EC5FC"
          onChange={handleCustomColor2}
        />
      </div>
    </div>
  );
}
