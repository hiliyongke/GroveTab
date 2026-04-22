/**
 * OnboardingCard — First-time user welcome card
 */

import { useState } from 'react';
import { TreePine, ArrowRight } from 'lucide-react';
import { markOnboardingDone } from '@/repositories';

interface OnboardingCardProps {
  onDismiss: () => void;
}

export function OnboardingCard({ onDismiss }: OnboardingCardProps) {
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = async () => {
    await markOnboardingDone();
    setDismissed(true);
    onDismiss();
  };

  if (dismissed) return null;

  return (
    <div
      className="max-w-md mx-auto mb-8 p-6 rounded-[var(--radius-lg)]
        bg-white/20 backdrop-blur-xl border border-white/30
        text-center"
    >
      <TreePine className="w-12 h-12 text-white/70 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-white/90 mb-2">
        欢迎使用 Canopy 🌿
      </h2>
      <p className="text-sm text-white/60 mb-1">
        你的标签，一目了然。
      </p>
      <p className="text-xs text-white/40 mb-6">
        每次打开新标签页，所有已打开的网页都会在这里展示。
        <br />
        按域名分组、搜索、归档——3 秒内找到任何标签。
      </p>
      <button
        onClick={handleDismiss}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[var(--radius-md)]
          bg-white/25 hover:bg-white/35 border border-white/30
          text-white/90 text-sm font-medium
          transition-all duration-200 cursor-pointer"
      >
        开始使用
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}
