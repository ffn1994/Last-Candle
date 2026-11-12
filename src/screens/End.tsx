import { motion } from 'framer-motion';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '../components/Button';
import { GradeBadge } from '../components/GradeBadge';
import { ar } from '../i18n/ar';
import { useStore } from '../store';
import { SCENARIOS, getScenario } from '../data/scenarios';
import { fmtPct } from '../format';
import { sfx } from '../fx';
import { useScreenFocus } from '../device';
import { isHistoricalId } from '../data/historical';
import { shareResult } from '../share';
import { track } from '../analytics';
import { DailyBoard } from '../components/DailyBoard';

const step = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: i * 0.7, duration: 0.35 },
});

function Stat({ label, children, tone }: { label: string; children: ReactNode; tone?: 'up' | 'down' }) {
  return (
    <div className="rounded-xl bg-surface p-3 text-center">
      <div className="text-xs text-muted">{label}</div>
      <div className={`num text-lg font-bold ${tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : ''}`}>{children}</div>
    </div>
  );
}

export function End() {
  const res = useStore((s) => s.lastResult);
  const unlocked = useStore((s) => s.unlocked);
  const { prepare, go } = useStore.getState();
  const survived = res?.round.status === 'survived';
  const rootRef = useScreenFocus<HTMLDivElement>();
  const [sharing, setSharing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => { if (res) sfx.end(survived); }, [res, survived]);
  if (!res) return null;

  const { round: r, stats: st, lessons } = res;
  const nextId = r.scenarioId + 1;
  const hasNext = !r.daily && nextId <= SCENARIOS.length && nextId <= unlocked;

  return (
 <motion.div ref={rootRef} className="absolute inset-0 overflow-y-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="safe-top flex flex-col items-center gap-4 px-4 pb-6 pt-6">
        <motion.h1
          initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}
          className={`text-5xl font-bold ${survived ? 'text-gold text-glow' : 'text-down'}`}
        >
          {survived ? `🕯️ ${ar.end.survived}` : ar.end.liquidated}
        </motion.h1>

        <motion.div {...step(1)} className="text-center">
          <div className="text-muted">{ar.end.youTraded}</div>
          <div className="text-2xl font-bold">{getScenario(r.scenarioId).name}</div>
          {res.unlockedNew && <div className="mt-1 text-sm text-gold">🔓 {ar.end.unlocked}</div>}
          {isHistoricalId(r.scenarioId) && <div className="mt-1 text-xs text-muted">📜 {ar.hist.endNote}</div>}
        </motion.div>

        <motion.div {...step(2)} className="flex flex-col items-center gap-1">
          <GradeBadge grade={st.grade} delay={1.4} />
          <div className="text-sm text-muted">{ar.end.grade}</div>
        </motion.div>

        {!!res.newTools?.length && (
          <motion.div {...step(2.5)} className="w-full rounded-2xl border-2 border-gold bg-gold/10 p-4 glow-gold">
            <h2 className="mb-2 font-bold text-gold">{ar.progress.unlockedTitle}</h2>
            {res.newTools.map((t) => (
              <div key={t}>
                <div className="font-semibold">{ar.progress.tools[t].name}</div>
                <p className="text-sm leading-relaxed text-muted">{ar.progress.tools[t].desc}</p>
              </div>
            ))}
          </motion.div>
        )}

        {r.daily && <motion.div {...step(2.8)} className="w-full"><DailyBoard round={r} /></motion.div>}

        <motion.div {...step(3)} className="grid w-full grid-cols-3 gap-2">
          <Stat label={ar.end.returnPct} tone={st.returnPct >= 0 ? 'up' : 'down'}>{st.returnPct >= 0 ? '▲' : '▼'} {fmtPct(st.returnPct)}</Stat>
          <Stat label={ar.end.maxDd} tone="down">▼ {st.maxDrawdownPct.toFixed(1)}%</Stat>
          <Stat label={ar.end.winRate}>{st.winRate.toFixed(0)}%</Stat>
          <Stat label={ar.end.trades}>{st.trades}</Stat>
          <Stat label={ar.end.discipline}>{st.discipline}/100</Stat>
          <Stat label={ar.game.nerves}>{Math.round(st.finalNerves)}</Stat>
        </motion.div>

        <motion.div {...step(4)} className="w-full rounded-2xl border border-border bg-surface p-4">
          <h2 className="mb-3 font-bold text-gold">{ar.end.lessons}</h2>
          <ol className="space-y-3">
            {lessons.map((l, i) => (
              <li key={l} className="flex gap-3 leading-relaxed">
                <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/15 text-sm text-gold">{i + 1}</span>
                <span>{l}</span>
              </li>
            ))}
          </ol>
        </motion.div>

        <motion.div {...step(5)} className="w-full rounded-2xl border border-border bg-surface p-4">
          <h2 className="mb-3 font-bold text-gold">📐 {ar.classic.review}</h2>
          {!res.patterns?.length ? (
            <p className="text-sm text-muted">{ar.classic.reviewNone}</p>
          ) : (
            <ul className="space-y-2">
              {res.patterns.map((p) => (
                <li key={`${p.kind}${p.confirmAt}`} className="rounded-xl bg-surface-2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-semibold ${p.dir === 'up' ? 'text-up' : 'text-down'}`}>
                      {p.dir === 'up' ? '▲' : '▼'} {ar.classic.names[p.kind]}
                    </span>
                    <span className="text-xs text-muted">{ar.classic.candle(p.confirmAt + 1)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{ar.classic.desc[p.kind]}</p>
                  <div className="mt-1.5 flex gap-3 text-xs">
                    <span className={p.outcome === 'reached' ? 'text-up' : p.outcome === 'failed' ? 'text-down' : 'text-muted'}>{ar.classic.outcome[p.outcome]}</span>
                    {p.traded && <span className="text-gold">✓ {ar.classic.traded}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </motion.div>

        <motion.div {...step(6)} className="safe-bottom flex w-full flex-col gap-3">
          <Button
            variant="gold" disabled={sharing}
            onClick={async () => {
              setSharing(true);
              const out = await shareResult({
                survived, market: getScenario(r.scenarioId).name, grade: st.grade,
                returnPct: st.returnPct, maxDrawdownPct: st.maxDrawdownPct, discipline: st.discipline,
              }).catch(() => 'cancelled' as const);
              setSharing(false);
              track('share', { outcome: out, grade: st.grade });
              if (out === 'downloaded') setNote(ar.share.downloaded);
            }}
          >
            {ar.share.button}
          </Button>
          {note && <p className="text-center text-sm text-gold">{note}</p>}
          <Button variant="secondary" onClick={() => go('replay')}>{ar.replay.open}</Button>
          <Button variant="secondary" onClick={() => prepare({ mode: r.mode, scenarioId: r.scenarioId, daily: r.daily })}>{ar.end.again}</Button>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" disabled={!hasNext} onClick={() => prepare({ mode: r.mode, scenarioId: nextId })}>
              {ar.end.nextRound}
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => go('menu')}>{ar.end.menu}</Button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
