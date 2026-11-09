import { motion } from 'framer-motion';
import { useState } from 'react';
import { Header, Screen } from '../components/Screen';
import { ar } from '../i18n/ar';
import { useStore } from '../store';
import { SCENARIOS } from '../data/scenarios';
import type { Mode } from '../game/types';

export function ModeSelect() {
  const daily = useStore((s) => s.dailyFlow);
  const unlocked = useStore((s) => s.unlocked);
  const survivedIds = useStore((s) => s.survivedIds);
  const { prepare, go } = useStore.getState();
  const [mode, setMode] = useState<Mode | null>(null);

  const pickMode = (m: Mode) => (daily ? prepare({ mode: m, daily: true }) : setMode(m));

  return (
    <Screen>
      <Header title={daily ? ar.mode.dailyTitle : mode ? ar.mode.scenarios : ar.mode.title} onBack={() => (mode ? setMode(null) : go('menu'))} />
      <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-6">
        {daily && <p className="text-muted">{ar.mode.dailyDesc}</p>}
        {!mode ? (
          (['normal', 'sharia'] as Mode[]).map((m, i) => (
            <motion.button
              key={m} type="button" onClick={() => pickMode(m)}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              whileTap={{ scale: 0.97 }}
              className="w-full rounded-2xl border border-border bg-surface p-5 text-start active:border-gold"
            >
              <div className="mb-1 text-xl font-bold">{m === 'normal' ? ar.mode.normal : ar.mode.sharia}</div>
              <div className="text-sm text-muted">{m === 'normal' ? ar.mode.normalDesc : ar.mode.shariaDesc}</div>
            </motion.button>
          ))
        ) : (
          SCENARIOS.map((sc, i) => {
            const locked = sc.id > unlocked;
            const done = survivedIds.includes(sc.id);
            return (
              <motion.button
                key={sc.id} type="button" disabled={locked}
                onClick={() => prepare({ mode, scenarioId: sc.id })}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                whileTap={locked ? undefined : { scale: 0.97 }}
                className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-start ${
                  locked ? 'border-border bg-surface opacity-40' : 'border-border bg-surface active:border-gold'}`}
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${locked ? 'bg-surface-2' : 'bg-gold/15'}`}>
                  {locked ? '🔒' : done ? '🕯️' : '❔'}
                </div>
                <div className="flex-1">
                  <div className="text-lg font-bold">{ar.mode.unknownMarket(sc.id)}</div>
                  <div className="text-sm text-muted">{locked ? ar.mode.locked : done ? `✓ ${ar.mode.survived}` : ''}</div>
                </div>
              </motion.button>
            );
          })
        )}
      </div>
    </Screen>
  );
}
