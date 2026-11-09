import { describe, expect, it } from 'vitest';
import { restoreScreen } from './store';
import { newRound } from './game/engine';

const round = newRound({ scenarioId: 1, mode: 'normal', seed: 1, daily: false });
const base = { round: null, lastResult: null, pending: null };

describe('restoreScreen after reload', () => {
  it('returns to the game when a round is saved', () => {
    expect(restoreScreen({ ...base, screen: 'game', round })).toBe('game');
  });
  it('falls back to the menu when the needed data is gone', () => {
    expect(restoreScreen({ ...base, screen: 'game' })).toBe('menu');
    expect(restoreScreen({ ...base, screen: 'end' })).toBe('menu');
    expect(restoreScreen({ ...base, screen: 'briefing' })).toBe('menu');
  });
  it('keeps other screens and never restores the splash', () => {
    expect(restoreScreen({ ...base, screen: 'history' })).toBe('history');
    expect(restoreScreen({ ...base, screen: 'splash' })).toBeUndefined();
    expect(restoreScreen({ ...base })).toBeUndefined();
  });
});

import { reviewPatterns, roundCandles } from './store';
import { applyCandle, openTrade } from './game/engine';
import { detectPatterns } from './game/patterns';

describe('pattern review', () => {
  it('lists patterns completed during play and credits a trade in their direction', () => {
    let r = newRound({ scenarioId: 2, mode: 'normal', seed: 1, daily: false, gen: 2 });
    const c = roundCandles(r);
    const hs = detectPatterns(c).find((p) => p.kind === 'hs')!;
    while (r.index < hs.confirmAt) r = applyCandle(r, c[r.index + 1]);
    r = openTrade(r, { side: 'short', riskPct: 1, stop: c[r.index].close * 1.05, tp: null }, c[r.index].close, 1);
    while (r.index < 150) r = applyCandle(r, c[r.index + 1]);
    const review = reviewPatterns(r);
    const item = review.find((p) => p.kind === 'hs')!;
    expect(item.dir).toBe('down');
    expect(item.traded).toBe(true);
    expect(review.every((p) => p.confirmAt >= 60 && p.confirmAt <= 150)).toBe(true);
  });
});
