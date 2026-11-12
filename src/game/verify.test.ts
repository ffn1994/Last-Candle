import { describe, expect, it } from 'vitest';
import { useStore, roundCandles, currentPrice, currentAtr } from '../store';
import { replayActions, verifyRound } from './verify';
import { computeStats } from './scoring';
import { defaultStop } from './engine';
import { mulberry32 } from './rng';

/** Play a whole round through the real store with random (sometimes bad) decisions. */
function playRandom(seed: number, mode: 'normal' | 'sharia' = 'normal') {
  const rng = mulberry32(seed);
  const st = useStore.getState();
  st.prepare({ mode, scenarioId: (seed % 5) + 1 });
  useStore.getState().startRound();
  for (let guard = 0; guard < 400 && useStore.getState().round; guard++) {
    const g = useStore.getState();
    if (g.activeNews) g.dismissNews();
    const r = g.round!;
    const roll = rng();
    if (!r.position && roll < 0.12) {
      const side = mode === 'sharia' || rng() < 0.5 ? 'long' : 'short';
      const price = currentPrice(r);
      const stop = rng() < 0.2 ? null : defaultStop(side, price, currentAtr(r) * (0.5 + rng()));
      g.open({ side, riskPct: [0.5, 1, 2, 5][Math.floor(rng() * 4)], stop, tp: null, analysis: rng() < 0.3 });
    } else if (r.position && roll < 0.08) {
      g.close();
    } else if (r.position?.stop != null && roll < 0.14) {
      const p = r.position;
      g.moveStop(p.stop! + (p.side === 'long' ? -1 : 1) * (rng() - 0.3) * currentAtr(r)); // sometimes widens
    }
    useStore.getState().next();
  }
  return useStore.getState().lastResult!;
}

describe('verifying a round by replaying its actions', () => {
  it('reproduces the exact final state of real played rounds', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const res = playRandom(seed, seed % 4 === 0 ? 'sharia' : 'normal');
      const r = res.round;
      const replayed = replayActions({ scenarioId: r.scenarioId, seed: r.seed, gen: r.gen ?? 1, mode: r.mode, daily: r.daily }, roundCandles(r), r.actions ?? []);
      const strip = (x: typeof r) => ({ ...x, startedAt: 0, newsSeen: [], eventsSeen: [], actions: [] });
      expect(strip(replayed)).toEqual(strip(r));
      expect(computeStats(replayed)).toEqual(res.stats);
    }
  });
  it('the server version ignores the client "analysis" bonus', () => {
    const res = playRandom(3);
    const r = res.round;
    const v = verifyRound({ scenarioId: r.scenarioId, seed: r.seed, gen: r.gen ?? 1, mode: r.mode, daily: false }, roundCandles(r), r.actions);
    expect(typeof v).toBe('object');
    if (typeof v === 'object') {
      expect(v.stats.analysisTrades).toBe(0);
      expect(v.survived).toBe(r.status === 'survived');
    }
  });
  it('rejects malformed or out-of-order action logs and unfinished rounds', () => {
    const r = playRandom(5).round;
    const input = { scenarioId: r.scenarioId, seed: r.seed, gen: r.gen ?? 1, mode: r.mode, daily: false };
    const c = roundCandles(r);
    expect(verifyRound(input, c, 'x')).toBe('badActions');
    expect(verifyRound(input, c, [{ at: 80, t: 'close' }, { at: 70, t: 'close' }])).toBe('badActions');
    expect(verifyRound(input, c, [{ at: 80, t: 'open', side: 'long', riskPct: 50, stop: null, tp: null }])).toBe('badActions');
    expect(verifyRound(input, c, [{ at: 80, t: 'hack' }])).toBe('badActions');
    expect(verifyRound({ ...input, mode: 'god' as never }, c, [])).toBe('badMode');
  });
});
