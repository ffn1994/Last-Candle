import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { ar } from '../i18n/ar';
import type { NerveEvent } from '../game/types';

/** Gold (#F0B90B) at full nerves → red (#EA3943) when empty. */
function nervesColor(v: number) {
  const t = 1 - v / 100;
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `rgb(${mix(240, 234)}, ${mix(185, 57)}, ${mix(11, 67)})`;
}

export function NervesBar({ value, log, compact = false }: { value: number; log: NerveEvent[]; compact?: boolean }) {
  const [flash, setFlash] = useState<NerveEvent | null>(null);
  const len = log.length;
  useEffect(() => {
    if (!len) return;
    setFlash(log[len - 1]);
    const t = window.setTimeout(() => setFlash(null), 1600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [len]);

  const flashEl = (
    <AnimatePresence>
      {flash && (
        <motion.span
          key={len}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className={`whitespace-nowrap font-semibold ${flash.delta > 0 ? 'text-up' : 'text-down'}`}
        >
          <span className="num">{flash.delta > 0 ? `▲ +${flash.delta}` : `▼ ${flash.delta}`}</span>{' '}
          {ar.game.nerveReasons[flash.reason]}
        </motion.span>
      )}
    </AnimatePresence>
  );

  // one slim line: label · bar · value (and the latest change)
  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 text-xs text-muted">
        <span>{ar.game.nerves}</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={ar.game.nerves}>
          <motion.div className="h-full rounded-full" animate={{ width: `${value}%`, backgroundColor: nervesColor(value) }} transition={{ duration: 0.3 }} />
        </div>
        {flashEl}
        <span className="num w-6 text-center font-semibold text-text">{Math.round(value)}</span>
      </div>
    );
  }

  return (
    <div className="px-4 py-1.5">
      <div className="mb-1 flex items-center justify-between text-xs text-muted">
        <span>{ar.game.nerves}</span>
        <div className="flex items-center gap-2">
          <AnimatePresence>
            {flash && (
              <motion.span
                key={len}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className={`font-semibold ${flash.delta > 0 ? 'text-up' : 'text-down'}`}
              >
                <span className="num">{flash.delta > 0 ? `▲ +${flash.delta}` : `▼ ${flash.delta}`}</span>{' '}
                {ar.game.nerveReasons[flash.reason]}
              </motion.span>
            )}
          </AnimatePresence>
          <span className="num font-semibold text-text">{Math.round(value)}</span>
        </div>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-surface-2" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={ar.game.nerves}>
        <motion.div
          className="h-full rounded-full"
          animate={{ width: `${value}%`, backgroundColor: nervesColor(value) }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </div>
  );
}
