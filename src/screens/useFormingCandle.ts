import { useEffect, useRef, useState } from 'react';
import { partialCandle, pathOrder, tickPath } from '../game/forming';
import type { Candle, RoundState } from '../game/types';
import { roundCandles, useStore, type Speed } from '../store';

/** Time for one candle to form, per auto-play speed. */
export const FORM_MS: Record<Speed, number> = { 1: 1100, 2: 550, 4: 260 };
const TICKS = 28;

interface Forming {
  candle: Candle;
  path: number[];
  dur: number;
  elapsed: number;
  done: boolean;
}

/**
 * Animates the next candle tick by tick, then commits it to the engine.
 * Time stops while `blocked` (pause, news, sheets) so nothing moves behind a dialog.
 */
export function useFormingCandle(r: RoundState | null, speed: Speed, enabled: boolean, blocked: boolean) {
  const [k, setK] = useState<number | null>(null);
  const ref = useRef<Forming | null>(null);
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;

  const active = k !== null;

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    let shown = -1;
    const tick = (now: number) => {
      const f = ref.current;
      if (!f || f.done) return;
      if (!blockedRef.current) f.elapsed += now - last;
      last = now;
      if (f.elapsed >= f.dur) {
        f.done = true;
        ref.current = null;
        setK(null);
        useStore.getState().next();
        return;
      }
      const step = Math.floor((f.elapsed / f.dur) * (f.path.length - 1));
      if (step !== shown) { shown = step; setK(step); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  /** Start forming the next candle (or commit it instantly when motion is off). */
  const start = () => {
    if (!r || r.status !== 'playing' || ref.current) return;
    const next = roundCandles(r)[r.index + 1];
    if (!next) return;
    if (!enabled) { useStore.getState().next(); return; }
    ref.current = {
      candle: next,
      path: tickPath(next, pathOrder(next, r.position), TICKS, (r.seed + r.index) >>> 0),
      dur: FORM_MS[speed],
      elapsed: 0,
      done: false,
    };
    setK(0);
  };

  /** Jump to the end of the candle that is forming. */
  const finish = () => {
    if (ref.current) ref.current.elapsed = ref.current.dur;
  };

  const f = ref.current;
  const partial = f && k !== null ? partialCandle(f.candle, f.path, k) : null;
  return { partial, forming: active, start, finish };
}
