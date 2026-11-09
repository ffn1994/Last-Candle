import { describe, expect, it } from 'vitest';
import { partialCandle, pathOrder, tickPath } from './forming';
import { newRound, openTrade, triggerFor } from './engine';
import { mulberry32 } from './rng';
import type { Candle } from './types';

const c: Candle = { time: 1, open: 100, high: 106, low: 97, close: 104, volume: 1000 };

describe('forming candle', () => {
  it('path starts at open, ends at close and touches high and low exactly', () => {
    for (const order of ['lowFirst', 'highFirst'] as const) {
      const p = tickPath(c, order, 24, 3);
      expect(p[0]).toBe(100);
      expect(p[p.length - 1]).toBe(104);
      expect(Math.max(...p)).toBe(106);
      expect(Math.min(...p)).toBe(97);
    }
  });
  it('the final partial candle equals the real candle', () => {
    const p = tickPath(c, 'lowFirst');
    const last = partialCandle(c, p, p.length - 1);
    expect(last).toEqual(c);
  });
  it('visits the low first for longs, the high first for shorts', () => {
    const p = tickPath(c, 'lowFirst');
    expect(p.indexOf(97)).toBeLessThan(p.indexOf(106));
    const q = tickPath(c, 'highFirst');
    expect(q.indexOf(106)).toBeLessThan(q.indexOf(97));
  });

  it('the first level hit during the animation is the one the engine fills', () => {
    const rng = mulberry32(99);
    for (let t = 0; t < 2000; t++) {
      const open = 100 + (rng() - 0.5) * 10;
      const close = 100 + (rng() - 0.5) * 10;
      const k: Candle = {
        time: 1, open, close,
        high: Math.max(open, close) + rng() * 5,
        low: Math.min(open, close) - rng() * 5,
      };
      const side = rng() < 0.5 ? 'long' : 'short';
      const stop = side === 'long' ? 100 - 1 - rng() * 6 : 100 + 1 + rng() * 6;
      const tp = rng() < 0.3 ? null : side === 'long' ? 100 + 1 + rng() * 6 : 100 - 1 - rng() * 6;
      const s = openTrade(newRound({ scenarioId: 1, mode: 'normal', seed: 1, daily: false }), { side, riskPct: 1, stop, tp }, 100, 2);
      const pos = s.position!;
      const path = tickPath(k, pathOrder(k, pos), 24, t);
      let firstHit = null;
      for (let i = 0; i < path.length && !firstHit; i++) firstHit = triggerFor(pos, partialCandle(k, path, i));
      expect(firstHit).toEqual(triggerFor(pos, k));
    }
  });
});
