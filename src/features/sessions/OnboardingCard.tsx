/**
 * OnboardingCard — First-time user welcome card
 */

import { useState } from 'react';
import { TreePine, ArrowRight } from 'lucide-react';
import { markOnboardingDone } from '@/repositories';
import { useT } from '@/shared/i18n';

interface OnboardingCardProps {
  onDismiss: () => void;
}

export function OnboardingCard({ onDismiss }: OnboardingCardProps) {
  const [dismissed, setDismissed] = useState(false);
  const { t } = useT();

  const handleDismiss = async () => {
    await markOnboardingDone();
    setDismissed(true);
    onDismiss();
  };

  if (dismissed) return null;

  return (
    <div
      className="max-w-md mx-auto mb-8 p-6 rounded-[var(--radius-lg)]
        bg-surface backdrop-blur-xl border border-border
        text-center"
    >
      <TreePine className="w-12 h-12 text-text-secondary mx-auto mb-4" />
      <h2 className="text-xl font-bold text-text mb-2">
        {t('onboarding.title')}
      </h2>
      <p className="text-sm text-text-secondary mb-1">
        {t('onboarding.desc')}
      </p>
      <p className="text-xs text-text-muted mb-6">
        {t('onboarding.detail')}
      </p>
      <button
        onClick={handleDismiss}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[var(--radius-md)]
          bg-surface-hover hover:bg-badge border border-border
          text-text text-sm font-medium
          transition-colors duration-200 cursor-pointer"
      >
        {t('onboarding.dismiss')}
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}
