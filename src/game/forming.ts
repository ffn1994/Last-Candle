/**
 * Intra-candle price path used to animate a candle "forming" tick by tick.
 * The path is ordered so that the first level touched during the animation is
 * always the one the engine fills (see triggerFor): a long position visits the
 * low first (stop side), a short visits the high first.
 */
import { mulberry32 } from './rng';
import type { Candle, Position } from './types';

export type PathOrder = 'lowFirst' | 'highFirst';

export function pathOrder(c: Candle, pos: Position | null): PathOrder {
  if (pos) return pos.side === 'long' ? 'lowFirst' : 'highFirst';
  return c.close >= c.open ? 'lowFirst' : 'highFirst';
}

/** Deterministic path of `n` (≥4) prices: open → first extreme → second extreme → close. */
export function tickPath(c: Candle, order: PathOrder, n = 24, seed = 1): number[] {
  const rng = mulberry32(seed);
  const [a, b] = order === 'lowFirst' ? [c.low, c.high] : [c.high, c.low];
  // split the ticks across 3 legs, each at least one step
  const legs = [0.3, 0.45, 0.25].map((f) => Math.max(1, Math.round(f * (n - 1))));
  const anchors = [c.open, a, b, c.close];
  const out: number[] = [c.open];
  for (let l = 0; l < 3; l++) {
    const from = anchors[l];
    const to = anchors[l + 1];
    const steps = legs[l];
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const base = from + (to - from) * t;
      // small wiggle that never escapes [low, high] and vanishes at the anchors
      const wiggle = s === steps ? 0 : (rng() - 0.5) * (c.high - c.low) * 0.12;
      out.push(Math.min(c.high, Math.max(c.low, base + wiggle)));
    }
  }
  return out;
}

/** The candle as it looks after `k` ticks of the path. */
export function partialCandle(c: Candle, path: number[], k: number): Candle {
  const upto = path.slice(0, Math.max(1, Math.min(path.length, k + 1)));
  return {
    time: c.time,
    open: c.open,
    high: Math.max(...upto),
    low: Math.min(...upto),
    close: upto[upto.length - 1],
    volume: c.volume !== undefined ? (c.volume * upto.length) / path.length : undefined,
  };
}
