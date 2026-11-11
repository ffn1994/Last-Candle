import { motion } from 'framer-motion';
import { useState } from 'react';
import { Modal } from '../components/Modal';
import { HISTORICAL } from '../data/historical';
import { Header, Screen } from '../components/Screen';
import { ar } from '../i18n/ar';
import { useStore } from '../store';
import { SCENARIOS } from '../data/scenarios';
import type { Mode } from '../game/types';

export function ModeSelect() {
  const daily = useStore((s) => s.dailyFlow);
  const unlocked = useStore((s) => s.unlocked);
  const survivedIds = useStore((s) => s.survivedIds);
  const customs = useStore((s) => s.customs);
  const mode = useStore((s) => s.modePick);
  const { prepare, go, setModePick: setMode, openBuilder, deleteCustom } = useStore.getState();
  const [confirmDel, setConfirmDel] = useState<number | null>(null);

  const pickMode = (m: Mode) => (daily ? prepare({ mode: m, daily: true }) : setMode(m));

  return (
    <Screen focusKey={mode}>
      <Header title={daily ? ar.mode.dailyTitle : mode ? ar.mode.scenarios : ar.mode.title} onBack={() => (mode ? setMode(null) : go('menu'))} />
      <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-6">
        {daily && <p className="text-muted">{ar.mode.dailyDesc}</p>}
        {!mode ? (
          (['normal', 'sharia'] as Mode[]).map((m, i) => (
            <motion.button
              key={m} type="button" onClick={() => pickMode(m)} data-primary={i === 0 ? '' : undefined}
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
                // remote users start on the newest unlocked market
                data-primary={sc.id === unlocked ? '' : undefined}
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

        {mode && (
          <>
            <h2 className="pt-3 text-sm font-semibold text-gold">{ar.hist.section}</h2>
            <p className="-mt-2 text-xs text-muted">{ar.hist.sectionDesc}</p>
            {HISTORICAL.map((sc, i) => (
              <motion.button
                key={sc.id} type="button" onClick={() => prepare({ mode, scenarioId: sc.id })}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                whileTap={{ scale: 0.97 }}
                className="flex w-full items-center gap-4 rounded-2xl border border-gold/30 bg-surface p-4 text-start active:border-gold"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold/15 text-2xl">📜</div>
                <div className="flex-1">
                  <div className="text-lg font-bold">{ar.hist.market(i + 1)}</div>
                  <div className="text-sm text-muted">{survivedIds.includes(sc.id) ? `✓ ${ar.mode.survived}` : ar.hist.weekly}</div>
                </div>
              </motion.button>
            ))}

            <h2 className="pt-3 text-sm font-semibold text-muted">🎨 {ar.builder.mine}</h2>
            {customs.map((m) => (
              <div key={m.id} className="flex items-center gap-2 rounded-2xl border border-border bg-surface p-2">
                <button
                  type="button" onClick={() => prepare({ mode, scenarioId: m.id })}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 text-start active:scale-[0.98]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-xl">🎨</span>
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{m.name}</span>
                    <span className="block text-xs text-muted">{ar.builder.vol[m.vol]}</span>
                  </span>
                </button>
                <button type="button" onClick={() => openBuilder(m.id)} aria-label={ar.builder.edit}
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 active:scale-95">✏️</button>
                <button type="button" onClick={() => setConfirmDel(m.id)} aria-label={ar.builder.delete}
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 active:scale-95">🗑</button>
              </div>
            ))}
            <button
              type="button" onClick={() => openBuilder(null)}
              className="w-full rounded-2xl border border-dashed border-gold/60 p-4 font-semibold text-gold active:scale-[0.98]"
            >
              {ar.builder.newMarket}
            </button>
          </>
        )}
      </div>
      <Modal
        open={confirmDel !== null} message={ar.builder.deleteConfirm} confirm={ar.builder.deleteYes} cancel={ar.pause.exitNo} danger
        onConfirm={() => { if (confirmDel !== null) deleteCustom(confirmDel); setConfirmDel(null); }}
        onCancel={() => setConfirmDel(null)}
      />
    </Screen>
  );
}
