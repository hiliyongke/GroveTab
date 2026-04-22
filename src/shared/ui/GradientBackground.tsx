/**
 * GradientBackground — Animated gradient background with preset switching
 */

import { useEffect, useRef } from 'react';
import { useSettingsStore } from '@/store';

const GRADIENT_PRESETS: Record<string, string> = {
  aurora: 'linear-gradient(135deg, #F5F7FA 0%, #C3CFE2 25%, #E0C3FC 50%, #8EC5FC 75%, #E0C3FC 100%)',
  sunrise: 'linear-gradient(135deg, #FEE140 0%, #FA709A 40%, #FDBB6F 70%, #FEE140 100%)',
  deepspace: 'linear-gradient(135deg, #0F2027 0%, #203A43 40%, #2C5364 70%, #0F2027 100%)',
};

export function GradientBackground({ children }: { children: React.ReactNode }) {
  const gradientPreset = useSettingsStore((s) => s.settings.gradientPreset);
  const customGradient = useSettingsStore((s) => s.settings.customGradient);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (gradientPreset === 'custom' && customGradient) {
      el.style.background = customGradient;
    } else if (GRADIENT_PRESETS[gradientPreset]) {
      el.style.background = GRADIENT_PRESETS[gradientPreset];
    }
    el.style.backgroundSize = '400% 400%';
    el.style.backgroundAttachment = 'fixed';
  }, [gradientPreset, customGradient]);

  return (
    <div ref={containerRef} className="gradient-animated min-h-screen">
      {children}
    </div>
  );
}
