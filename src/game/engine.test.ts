import { describe, expect, it } from 'vitest';
import {
  applyCandle, closeTrade, moveStop, newRound, openTrade, positionSize, triggerFor, validateOpen,
  LIQUIDATION_EQUITY, START_EQUITY, TOTAL_CANDLES,
} from './engine';
import { NERVES } from './nerves';
import { computeStats, disciplineScore, gradeFor } from './scoring';
import { lessonsFor } from './lessons';
import type { Candle, RoundState } from './types';
import { SCENARIOS, dailyChallenge, generateCandles } from '../data/scenarios';

const c = (o: number, h: number, l: number, cl: number): Candle => ({ time: 0, open: o, high: h, low: l, close: cl });
const flat = (p = 100) => c(p, p + 0.5, p - 0.5, p);
const round = (mode: 'normal' | 'sharia' = 'normal') => newRound({ scenarioId: 1, mode, seed: 1, daily: false });
const long = (s: RoundState, stop: number | null = 95, tp: number | null = null, riskPct = 1) =>
  openTrade(s, { side: 'long', riskPct, stop, tp }, 100, 2.5);

describe('position sizing', () => {
  it('sizes so the stop loses exactly riskPct of equity', () => {
    const size = positionSize(10_000, 1, 100, 5, 'normal');
    expect(size).toBeCloseTo(20); // $100 risk / $5 distance
    expect(size * 5).toBeCloseTo(100);
  });
  it('caps notional by leverage (5x normal, 1x sharia)', () => {
    expect(positionSize(10_000, 5, 100, 0.1, 'normal') * 100).toBeCloseTo(50_000);
    expect(positionSize(10_000, 5, 100, 0.1, 'sharia') * 100).toBeCloseTo(10_000);
  });
  it('records effective risk when capped', () => {
    const s = openTrade(round('sharia'), { side: 'long', riskPct: 5, stop: 99, tp: null }, 100, 1);
    expect(s.position!.riskPct).toBeCloseTo(1); // 100 units × $1 = $100 = 1%
  });
  it('sizes no-stop trades with 2×ATR', () => {
    const s = long(round(), null);
    expect(s.position!.size).toBeCloseTo(100 / 5);
  });
});

describe('open validation', () => {
  it('rejects shorts in sharia mode', () => {
    expect(validateOpen(round('sharia'), { side: 'short', riskPct: 1, stop: 105, tp: null }, 100)).toBe('shortNotAllowed');
  });
  it('rejects a stop on the wrong side', () => {
    expect(validateOpen(round(), { side: 'long', riskPct: 1, stop: 101, tp: null }, 100)).toBe('badStop');
    expect(validateOpen(round(), { side: 'short', riskPct: 1, stop: 99, tp: null }, 100)).toBe('badStop');
  });
  it('allows only one open position', () => {
    expect(validateOpen(long(round()), { side: 'long', riskPct: 1, stop: 95, tp: null }, 100)).toBe('hasPosition');
  });
});

describe('stop / take-profit triggers', () => {
  const pos = long(round(), 95, 110).position!;
  it('fills the stop on the candle low', () => {
    expect(triggerFor(pos, c(100, 101, 94, 99))).toEqual({ price: 95, reason: 'stop' });
  });
  it('fills TP on the candle high', () => {
    expect(triggerFor(pos, c(100, 111, 99, 108))).toEqual({ price: 110, reason: 'tp' });
  });
  it('assumes the stop first when both are hit in one candle', () => {
    expect(triggerFor(pos, c(100, 112, 90, 105))?.reason).toBe('stop');
  });
  it('fills at the open on a gap through the stop', () => {
    expect(triggerFor(pos, c(90, 92, 88, 91))).toEqual({ price: 90, reason: 'stop' });
  });
  it('mirrors for shorts', () => {
    const sp = openTrade(round(), { side: 'short', riskPct: 1, stop: 105, tp: 90 }, 100, 2.5).position!;
    expect(triggerFor(sp, c(100, 106, 99, 104))?.reason).toBe('stop');
    expect(triggerFor(sp, c(100, 101, 89, 92))?.reason).toBe('tp');
  });
  it('applyCandle closes the trade and books the loss', () => {
    const s = applyCandle(long(round()), c(100, 101, 94, 96));
    expect(s.position).toBeNull();
    expect(s.cash).toBeCloseTo(START_EQUITY - 100);
    expect(s.trades[0].reason).toBe('stop');
  });
});

describe('nerves', () => {
  it('−15 for a trade without a stop', () => {
    expect(long(round(), null).nerves).toBe(100 + NERVES.noStop);
  });
  it('−10 for widening the stop, nothing for tightening', () => {
    const s = long(round());
    expect(moveStop(s, 93, 100).nerves).toBe(90);
    expect(moveStop(s, 97, 100).nerves).toBe(100);
    expect(moveStop(s, 93, 100).stopWidenings).toBe(1);
  });
  it('−10 for a revenge trade within 3 candles of a loss', () => {
    let s = applyCandle(long(round()), c(100, 101, 94, 96)); // stopped: +5 by plan, capped at 100
    s = { ...s, nerves: 80 };
    s = applyCandle(s, flat());
    expect(long(s).nerves).toBe(70);
    expect(long(s).position!.revenge).toBe(true);
  });
  it('no revenge penalty after the window', () => {
    let s = applyCandle(long(round()), c(100, 101, 94, 96));
    for (let i = 0; i < 4; i++) s = applyCandle(s, flat());
    expect(long(s).position!.revenge).toBe(false);
  });
  it('−5 per consecutive loss after the 2nd', () => {
    let s: RoundState = { ...round(), nerves: 50 };
    const lose = (x: RoundState) => closeTrade(long(x), 98, 'manual');
    s = lose(s); s = lose(s);
    expect(s.nerves).toBe(50 - 10); // 2nd trade is a revenge trade (−10); no streak penalty yet
    s = lose(s);
    expect(s.consecutiveLosses).toBe(3);
    expect(s.nerves).toBe(40 - 10 - 5); // revenge −10, 3rd loss −5
  });
  it('+5 when a trade closes by plan', () => {
    const s = applyCandle({ ...long(round(), 95, 110), nerves: 50 }, c(100, 111, 99, 108));
    expect(s.nerves).toBe(55);
  });
  it('+2 every 10 candles without a trade', () => {
    let s: RoundState = { ...round(), nerves: 50 };
    for (let i = 0; i < 20; i++) s = applyCandle(s, flat());
    expect(s.nerves).toBe(54);
  });
});

describe('round lifecycle', () => {
  it('liquidates at equity ≤ $5,000', () => {
    const s = openTrade(round(), { side: 'long', riskPct: 5, stop: null, tp: null }, 100, 0.1); // 500 units, 5x
    const next = applyCandle(s, c(100, 100, 89, 89));
    expect(next.cash).toBeLessThanOrEqual(LIQUIDATION_EQUITY);
    expect(next.status).toBe('liquidated');
  });
  it('survives after the last candle', () => {
    let s = round();
    while (s.status === 'playing') s = applyCandle(s, flat());
    expect(s.status).toBe('survived');
    expect(s.index).toBe(TOTAL_CANDLES - 1);
  });
  it('tracks max drawdown', () => {
    const s = applyCandle(long(round(), 80, null, 2), c(100, 100, 90, 90));
    expect(s.maxDrawdown).toBeCloseTo(0.01, 3); // 10 units × $10 = $100
  });
});

describe('grading', () => {
  it('discipline is 100 for perfect behaviour', () => {
    expect(disciplineScore({ stopsPct: 100, avgRiskPct: 1, revengeTrades: 0, finalNerves: 100 })).toBe(100);
  });
  it('punishes high risk and revenge', () => {
    expect(disciplineScore({ stopsPct: 0, avgRiskPct: 5, revengeTrades: 3, finalNerves: 0 })).toBe(0);
  });
  it('liquidation is always F', () => {
    expect(gradeFor(99, true)).toBe('F');
  });
  it('surviving with flat return but high discipline still grades well', () => {
    let s = round();
    while (s.status === 'playing') s = applyCandle(s, flat());
    const st = computeStats({ ...s, nerves: 90 });
    expect(['S', 'A']).toContain(st.grade);
  });
  it('a reckless profitable round grades below a disciplined flat one', () => {
    let s = round();
    for (let i = 0; i < 3; i++) {
      s = openTrade(s, { side: 'long', riskPct: 5, stop: null, tp: null }, 100, 2.5);
      s = closeTrade(s, 108, 'manual');
    }
    while (s.status === 'playing') s = applyCandle(s, flat());
    const reckless = computeStats(s);
    expect(reckless.returnPct).toBeGreaterThan(0);
    expect(['C', 'F', 'B']).toContain(reckless.grade);
  });
  it('produces 3 lessons', () => {
    const st = computeStats(long(round(), null));
    expect(lessonsFor(st, 1)).toHaveLength(3);
  });
});

describe('scenarios', () => {
  it('are deterministic per seed and have 200 valid candles', () => {
    for (const sc of SCENARIOS) {
      const a = generateCandles(sc, 42);
      expect(a).toHaveLength(TOTAL_CANDLES);
      expect(generateCandles(sc, 42)).toEqual(a);
      for (const k of a) {
        expect(k.high).toBeGreaterThanOrEqual(Math.max(k.open, k.close));
        expect(k.low).toBeLessThanOrEqual(Math.min(k.open, k.close));
        expect(k.low).toBeGreaterThan(0);
      }
    }
  });
  it('dot-com collapses ~60% from its peak', () => {
    const a = generateCandles(SCENARIOS[0], 7);
    const peak = Math.max(...a.map((k) => k.close));
    expect(a[199].close / peak).toBeLessThan(0.5);
  });
  it('daily challenge is stable for a date', () => {
    const d = new Date(2026, 10, 9);
    expect(dailyChallenge(d)).toEqual(dailyChallenge(d));
  });
});
