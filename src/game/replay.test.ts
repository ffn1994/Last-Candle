import { describe, expect, it } from 'vitest';
import { nervesTimeline, replayMarks } from './replay';
import { applyCandle, closeTrade, moveStop, newRound, openTrade } from './engine';
import type { Candle } from './types';

const flat: Candle = { time: 0, open: 100, high: 100.5, low: 99.5, close: 100 };

describe('round replay', () => {
  it('rebuilds the nerves level candle by candle from the log', () => {
    const tl = nervesTimeline([{ at: 61, delta: -15, reason: 'noStop' }, { at: 63, delta: 5, reason: 'byPlan' }], 59, 64);
    expect(tl.map((x) => x.v)).toEqual([100, 100, 85, 85, 90, 90]);
  });
  it('clamps like the game does', () => {
    expect(nervesTimeline([{ at: 60, delta: 5, reason: 'patience' }], 59, 60).at(-1)!.v).toBe(100);
  });
  it('marks entries, exits with result, mistakes and stop widening', () => {
    let s = newRound({ scenarioId: 1, mode: 'normal', seed: 1, daily: false });
    s = openTrade(s, { side: 'long', riskPct: 1, stop: null, tp: null }, 100, 2); // reckless at 59
    s = applyCandle(s, flat);
    s = closeTrade(s, 98, 'manual'); // loss at 60
    s = openTrade(s, { side: 'short', riskPct: 1, stop: 103, tp: null }, 100, 2); // revenge at 60
    s = moveStop(s, 105, 100); // widened at 60
    s = applyCandle(s, flat);
    s = closeTrade(s, 99, 'manual'); // win at 61
    const m = replayMarks(s.trades, s.nervesLog);
    expect(m.map((x) => `${x.i}:${x.kind}`)).toEqual(['59:entry', '60:exit', '60:entry', '60:widen', '61:exit']);
    expect(m[0].tags).toContain('reckless');
    expect(m[2].tags).toContain('revenge');
    expect(m[1].good).toBe(false);
    expect(m[4].good).toBe(true);
    // the nerves line shows the damage
    const tl = nervesTimeline(s.nervesLog, 59, 61);
    expect(tl[0].v).toBe(85);
    expect(tl[1].v).toBe(65); // revenge −10, widening −10
  });
});
