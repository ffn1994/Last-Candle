import { describe, expect, it } from 'vitest';
import { WEEK, heikinAshi, toWeekly } from './transform';
import { alertsHit, isAnalysisTrade, levelsAt, type Drawing } from './drawings';
import { closeTrade, newRound, openTrade } from './engine';
import { computeStats } from './scoring';
import { lessonsFor } from './lessons';
import type { Candle } from './types';

const day = (i: number, o: number, h: number, l: number, c: number, v = 10): Candle => ({ time: i, open: o, high: h, low: l, close: c, volume: v });

describe('weekly candles', () => {
  const days = Array.from({ length: 12 }, (_, i) => day(i, 100 + i, 105 + i, 95 + i, 101 + i));
  const w = toWeekly(days);
  it('groups 5 days per candle, the last one partial', () => {
    expect(w).toHaveLength(3);
    expect(WEEK).toBe(5);
  });
  it('open of first day, close of last, extreme high/low, summed volume, first day time', () => {
    expect(w[0]).toEqual({ time: 0, open: 100, high: 109, low: 95, close: 105, volume: 50 });
    expect(w[2]).toEqual({ time: 10, open: 110, high: 116, low: 105, close: 112, volume: 20 });
  });
});

describe('heikin ashi', () => {
  it('follows the standard formulas', () => {
    const ha = heikinAshi([day(0, 10, 12, 8, 11), day(1, 11, 14, 10, 13)]);
    expect(ha[0].close).toBe(10.25);
    expect(ha[0].open).toBe(10.5);
    expect(ha[1].open).toBe(10.375); // (10.5 + 10.25) / 2
    expect(ha[1].close).toBe(12);
    expect(ha[1].high).toBe(14);
    expect(ha[1].low).toBe(10);
  });
});

describe('price alerts', () => {
  const ds: Drawing[] = [
    { id: 'a', kind: 'hline', a: { i: 0, p: 150 }, alert: true, alertFrom: 61 },
    { id: 'b', kind: 'hline', a: { i: 0, p: 150 }, alert: true, alertFrom: 61, fired: true },
    { id: 'c', kind: 'hline', a: { i: 0, p: 150 } },
  ];
  it('fires when the candle range touches the line, only once and only from alertFrom', () => {
    expect(alertsHit(ds, { high: 151, low: 149 }, 61).map((d) => d.id)).toEqual(['a']);
    expect(alertsHit(ds, { high: 151, low: 149 }, 60)).toEqual([]); // before it was armed
    expect(alertsHit(ds, { high: 149, low: 140 }, 61)).toEqual([]); // not touched
  });
});

describe('analysis trades', () => {
  const ds: Drawing[] = [
    { id: 'h', kind: 'hline', a: { i: 0, p: 100 }, at: 50 },
    { id: 't', kind: 'trend', a: { i: 40, p: 90 }, b: { i: 80, p: 118 }, at: 50 },
    { id: 'z', kind: 'rect', a: { i: 40, p: 120 }, b: { i: 60, p: 125 }, at: 60 }, // drawn on the entry candle
  ];
  it('collects levels drawn before the candle, interpolating trend lines', () => {
    const lv = levelsAt(ds, 60);
    expect(lv).toContain(100);
    expect(lv).toContain(104); // trend at index 60: 90 + 28 × 20/40
    expect(lv).not.toContain(120);
    expect(levelsAt(ds, 61)).toContain(120);
  });
  it('needs entry near a level and the stop beyond it', () => {
    expect(isAnalysisTrade([100], 'long', 101, 98, 2)).toBe(true);
    expect(isAnalysisTrade([100], 'long', 101, 100.5, 2)).toBe(false); // stop above support
    expect(isAnalysisTrade([100], 'long', 110, 98, 2)).toBe(false); // too far from the level
    expect(isAnalysisTrade([100], 'short', 99, 102, 2)).toBe(true);
    expect(isAnalysisTrade([100], 'long', 101, null, 2)).toBe(false); // no stop, no plan
  });
  it('gives +3 nerves, is recorded on the trade and appears in the lessons', () => {
    let s = { ...newRound({ scenarioId: 1, mode: 'normal', seed: 1, daily: false }), nerves: 50 };
    s = openTrade(s, { side: 'long', riskPct: 1, stop: 95, tp: null, analysis: true }, 100, 2);
    expect(s.nerves).toBe(53);
    expect(s.nervesLog.at(-1)?.reason).toBe('analysis');
    s = closeTrade(s, 104, 'manual');
    const st = computeStats(s);
    expect(st.analysisTrades).toBe(1);
    expect(lessonsFor(st, 0).some((l) => l.includes('مستويات رسمتها'))).toBe(true);
  });
  it('no bonus without a stop even if flagged', () => {
    const s = openTrade(newRound({ scenarioId: 1, mode: 'normal', seed: 1, daily: false }), { side: 'long', riskPct: 1, stop: null, tp: null, analysis: true }, 100, 2);
    expect(s.position!.analysis).toBe(false);
  });
});
