import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { ar } from '../i18n/ar';
import { useStore } from '../store';

type Step = 'next' | 'trade' | 'stop' | 'nerves';

/** First-round tips, one at a time, picked from what the player is doing. */
export function CoachTip({ hasPosition, tradesDone, candlesSeen, className = '' }: {
  hasPosition: boolean; tradesDone: number; candlesSeen: number; className?: string;
}) {
  const show = useStore((s) => !s.coachDone && !s.settings.unlockAll);
  const [dismissed, setDismissed] = useState<Step[]>([]);
  if (!show) return null;

  const step: Step = hasPosition ? 'stop'
    : tradesDone > 0 ? 'nerves'
    : candlesSeen < 3 ? 'next'
    : 'trade';
  const visible = !dismissed.includes(step);
  const ok = () => {
    setDismissed((d) => [...d, step]);
    if (step === 'nerves') useStore.getState().finishCoach(); // last tip
  };

  return (
    <AnimatePresence initial={false} mode="wait">
      {visible && (
        <motion.div
          key={step}
          role="status"
          // part of the layout (never floating over buttons)
          className={`flex items-start gap-3 rounded-2xl border border-gold/50 bg-surface-2 p-3 ${className}`}
          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
        >
          <span aria-hidden className="text-xl">💡</span>
          <p className="flex-1 text-sm leading-relaxed">{ar.coach[step]}</p>
          <button type="button" onClick={ok} className="shrink-0 rounded-lg bg-gold px-3 py-1.5 text-xs font-bold text-bg active:scale-95">
            {ar.coach.close}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
