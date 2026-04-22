/**
 * GradientBackground — Animated gradient background with preset switching
 */

import { useEffect, useRef } from 'react';
import { useSettingsStore } from '@/store';

const GRADIENT_PRESETS: Record<string, string> = {
  aurora: 'linear-gradient(160deg, #f0f3f8 0%, #e4eaf5 40%, #dce4f2 70%, #d5deeD 100%)',
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
    el.style.backgroundSize = '100% 100%';
    el.style.backgroundAttachment = 'fixed';
  }, [gradientPreset, customGradient]);

  return (
    <div ref={containerRef} className="gradient-animated min-h-screen">
      {children}
    </div>
  );
}
