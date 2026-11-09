import { motion, useAnimationControls } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { CandleChart } from '../components/CandleChart';
import { Modal } from '../components/Modal';
import { NervesBar } from '../components/NervesBar';
import { NewsCard } from '../components/NewsCard';
import { TradeSheet } from '../components/TradeSheet';
import { ar } from '../i18n/ar';
import { currentAtr, roundCandles, useStore, type Speed } from '../store';
import { START_EQUITY, TOTAL_CANDLES, defaultStop, equityAt, pnlAt } from '../game/engine';
import { isLowNerves } from '../game/nerves';
import { fmtMoney, fmtPct, fmtPrice, fmtSignedMoney, fmtUnits } from '../format';
import { haptic, sfx } from '../fx';
import type { Side } from '../game/types';

const BASE_MS = 700;
const SPEEDS: Speed[] = [1, 2, 4];

export function Game() {
  const r = useStore((s) => s.round);
  const news = useStore((s) => s.activeNews);
  const pauseOpen = useStore((s) => s.pauseOpen);
  const defaultSpeed = useStore((s) => s.settings.speed);
  const store = useStore.getState();

  const [side, setSide] = useState<Side | null>(null);
  const [auto, setAuto] = useState(false);
  const [speed, setSpeed] = useState<Speed>(defaultSpeed);
  const [confirm, setConfirm] = useState<null | 'exit' | 'restart'>(null);
  const shake = useAnimationControls();

  // Only redirect when we're actually the current screen (not while animating out to 'end').
  useEffect(() => { if (!r && useStore.getState().screen === 'game') store.go('menu'); }, [r, store]);

  const candles = r ? roundCandles(r) : [];
  const index = r?.index ?? 0;
  const visible = useMemo(() => candles.slice(0, index + 1), [candles, index]);

  const blocked = !!news || pauseOpen || !!side || !!confirm;
  const low = r ? isLowNerves(r.nerves) : false;

  // auto-play
  useEffect(() => {
    if (!auto || blocked) return;
    const t = window.setInterval(() => useStore.getState().next(), BASE_MS / speed);
    return () => window.clearInterval(t);
  }, [auto, blocked, speed]);
  useEffect(() => { if (news) { setAuto(false); sfx.news(); haptic(30); } }, [news]);

  // per-candle feedback
  useEffect(() => {
    if (!r) return;
    sfx.tick();
    if (isLowNerves(r.nerves)) shake.start({ x: [0, -5, 5, -3, 3, 0], transition: { duration: 0.3 } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const tradeCount = r?.trades.length ?? 0;
  const prevTrades = useRef(tradeCount);
  useEffect(() => {
    if (r && tradeCount > prevTrades.current) {
      const last = r.trades[tradeCount - 1];
      if (last.pnl >= 0) sfx.win(); else sfx.loss();
      haptic(last.pnl >= 0 ? 20 : 40);
    }
    prevTrades.current = tradeCount;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradeCount]);

  if (!r) return null;

  const price = candles[index].close;
  const atr = currentAtr(r);
  const equity = equityAt(r, price);
  const changePct = ((equity - START_EQUITY) / START_EQUITY) * 100;
  const up = changePct >= 0;
  const pos = r.position;
  const pnl = pos ? pnlAt(pos, price) : 0;
  const holdMs = low ? 1000 : undefined;
  const canTrade = !pos && r.status === 'playing';

  const step = () => { if (!blocked) store.next(); };

  return (
    <motion.div
      className="absolute inset-0 flex flex-col"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
    >
      <motion.div animate={shake} className="flex min-h-0 flex-1 flex-col">
        {/* top bar */}
        <div className="safe-top flex items-center gap-2 px-3 pb-1">
          <Button size="icon" variant="secondary" ariaLabel={ar.pauseLabel} onClick={() => store.setPause(true)}>
            <span className="text-base">❚❚</span>
          </Button>
          <div className="flex-1 text-center">
            <div className="num text-[28px] font-bold leading-tight">{fmtMoney(equity)}</div>
            <div className={`num text-sm font-semibold ${up ? 'text-up' : 'text-down'}`}>
              {up ? '▲' : '▼'} {fmtPct(changePct, 2)}
            </div>
          </div>
          <div className="min-w-11 text-center text-sm text-muted">
            <span className="num">{index + 1} / {TOTAL_CANDLES}</span>
          </div>
        </div>

        <NervesBar value={r.nerves} log={r.nervesLog} />

        {/* chart */}
        <div className="relative mx-2 min-h-[240px] flex-1 overflow-hidden rounded-xl border border-border bg-surface">
          <CandleChart candles={visible} position={pos} onStopCommit={(p) => store.moveStop(p)} />
        </div>

        {/* position card */}
        <div className="mx-2 mt-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm">
          {pos ? (
            <>
              <div className="flex items-center justify-between">
                <span className={`font-bold ${pos.side === 'long' ? 'text-up' : 'text-down'}`}>
                  {pos.side === 'long' ? ar.game.long : ar.game.short}
                  {pos.reckless && <span className="ms-2 rounded bg-down px-1.5 py-0.5 text-xs text-white">{ar.game.reckless}</span>}
                </span>
                <span className={`num text-base font-bold ${pnl >= 0 ? 'text-up' : 'text-down'}`}>
                  {pnl >= 0 ? '▲' : '▼'} {fmtSignedMoney(pnl)}
                </span>
              </div>
              <div className="mt-1 grid grid-cols-4 gap-1 text-xs text-muted">
                <div>{ar.game.size}<div className="num text-text">{fmtUnits(pos.size)}</div></div>
                <div>{ar.game.entry}<div className="num text-text">{fmtPrice(pos.entry)}</div></div>
                <div>{ar.game.stop}<div className="num text-down">{pos.stop != null ? fmtPrice(pos.stop) : ar.game.none}</div></div>
                <div>{ar.game.risk}<div className="num text-text">{pos.reckless ? '∞' : `${pos.riskPct.toFixed(1)}%`}</div></div>
              </div>
              <div className="mt-2 flex gap-2">
                {pos.stop == null && (
                  <Button size="md" variant="secondary" className="h-10 flex-1 text-sm"
                    onClick={() => store.moveStop(defaultStop(pos.side, price, atr))}>
                    {ar.game.addStop}
                  </Button>
                )}
                <Button size="md" variant="secondary" className="h-10 flex-1 text-sm" onClick={() => store.close()}>
                  {ar.game.close}
                </Button>
              </div>
            </>
          ) : (
            <div className="py-1 text-center text-muted">{ar.game.noPosition}</div>
          )}
        </div>
      </motion.div>

      {/* bottom action bar — RTL: شراء on the right, بيع on the left */}
      <div className="safe-bottom relative px-2 pt-2">
        {auto && (
          <button
            type="button"
            onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
            className="absolute -top-9 left-1/2 -translate-x-1/2 rounded-full border border-gold/50 bg-surface-2 px-3 py-1 text-sm font-semibold text-gold"
          >
            {ar.game.auto} <span className="num">{speed}x</span>
          </button>
        )}
        <div className="flex gap-2">
          <Button variant="buy" className="flex-1" disabled={!canTrade} holdMs={holdMs} onClick={() => setSide('long')}>
            ▲ {ar.game.buy}
          </Button>
          <Button
            variant="gold" className="flex-[1.4] text-xl"
            onClick={() => { if (auto) setAuto(false); else step(); }}
            onLongPress={() => setAuto((a) => !a)}
          >
            {auto ? '❚❚' : `${ar.game.next} ◀`}
          </Button>
          <Button variant="sell" className="flex-1" disabled={!canTrade || r.mode === 'sharia'} holdMs={holdMs} onClick={() => setSide('short')}>
            ▼ {ar.game.sell}
          </Button>
        </div>
      </div>

      {/* low-nerves vignette */}
      {low && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-30"
          initial={{ opacity: 0 }} animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 2, repeat: Infinity }}
          style={{ background: 'radial-gradient(ellipse at center, transparent 45%, rgba(234,57,67,0.25) 100%)', boxShadow: 'inset 0 0 80px rgba(234,57,67,0.25)' }}
        />
      )}

      <TradeSheet
        side={side} round={r} price={price} atr={atr} holdMs={holdMs}
        onClose={() => setSide(null)}
        onConfirm={(p) => { store.open(p); sfx.open(); setSide(null); }}
      />

      <NewsCard text={news} onDismiss={() => store.dismissNews()} />

      <BottomSheet open={pauseOpen} onClose={() => store.setPause(false)} title={ar.pause.title}>
        <div className="flex flex-col gap-3 pb-2">
          <Button variant="gold" onClick={() => store.setPause(false)}>{ar.pause.resume}</Button>
          <Button variant="secondary" onClick={() => setConfirm('restart')}>{ar.pause.restart}</Button>
          <Button variant="secondary" onClick={() => store.openSettings('game')}>{ar.pause.settings}</Button>
          <Button variant="secondary" onClick={() => setConfirm('exit')}>{ar.pause.exit}</Button>
        </div>
      </BottomSheet>

      <Modal
        open={confirm === 'exit'}
        message={ar.pause.exitConfirm}
        confirm={ar.pause.exitYes}
        cancel={ar.pause.exitNo}
        onConfirm={() => { setConfirm(null); store.setPause(false); store.go('menu'); }}
        onCancel={() => setConfirm(null)}
      />
      <Modal
        open={confirm === 'restart'}
        message={ar.pause.restartConfirm}
        confirm={ar.pause.restartYes}
        cancel={ar.pause.exitNo}
        danger
        onConfirm={() => { setConfirm(null); setAuto(false); store.restartRound(); }}
        onCancel={() => setConfirm(null)}
      />
    </motion.div>
  );
}
