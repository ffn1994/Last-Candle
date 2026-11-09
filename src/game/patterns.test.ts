import { describe, expect, it } from 'vitest';
import { autoLevels, detectPatterns, outcomeOf, pivots } from './patterns';
import type { Candle } from './types';

/** Candles following straight lines between waypoints [index, price], with a tiny deterministic wiggle. */
function path(points: [number, number][]): Candle[] {
  const out: Candle[] = [];
  for (let k = 0; k + 1 < points.length; k++) {
    const [i0, p0] = points[k];
    const [i1, p1] = points[k + 1];
    for (let i = i0; i < i1; i++) {
      const close = p0 + ((p1 - p0) * (i + 1 - i0)) / (i1 - i0) + Math.sin(i * 1.7) * 0.05;
      const open = out.length ? out[out.length - 1].close : p0;
      out.push({ time: i, open, close, high: Math.max(open, close) + 0.3, low: Math.min(open, close) - 0.3 });
    }
  }
  return out;
}

describe('pivots', () => {
  it('alternate highs and lows at the turning points', () => {
    const c = path([[0, 100], [10, 110], [20, 100], [30, 112], [40, 98]]);
    const pv = pivots(c, 3);
    expect(pv.map((p) => p.kind).join('')).toBe('HLH');
    expect(Math.abs(pv[0].i - 9)).toBeLessThanOrEqual(1);
  });
});

describe('pattern recognition', () => {
  it('double top: two equal highs, then a close below the trough', () => {
    const c = path([[0, 90], [15, 110], [25, 100], [35, 110], [50, 92], [60, 90]]);
    const ps = detectPatterns(c);
    const dt = ps.find((p) => p.kind === 'doubleTop')!;
    expect(dt).toBeTruthy();
    expect(dt.dir).toBe('down');
    expect(dt.neckline).toBeCloseTo(99.7, 0);
    expect(dt.target).toBeLessThan(dt.neckline - 8); // measured move ≈ height of the formation
    expect(c[dt.confirmAt].close).toBeLessThan(dt.neckline);
    expect(c[dt.confirmAt - 1].close).toBeGreaterThanOrEqual(dt.neckline);
  });
  it('double bottom mirrors it', () => {
    const c = path([[0, 110], [15, 90], [25, 100], [35, 90], [50, 108], [60, 110]]);
    expect(detectPatterns(c).some((p) => p.kind === 'doubleBottom' && p.dir === 'up')).toBe(true);
  });
  it('head & shoulders wins over the double tops inside it', () => {
    const c = path([[0, 90], [10, 104], [18, 98], [28, 112], [38, 98], [46, 104], [60, 88], [70, 86]]);
    const ps = detectPatterns(c);
    expect(ps.some((p) => p.kind === 'hs')).toBe(true);
    expect(ps.some((p) => p.kind === 'doubleTop')).toBe(false);
  });
  it('inverse head & shoulders', () => {
    const c = path([[0, 110], [10, 96], [18, 102], [28, 88], [38, 102], [46, 96], [60, 112], [70, 114]]);
    expect(detectPatterns(c).some((p) => p.kind === 'ihs' && p.dir === 'up')).toBe(true);
  });
  it('range breakout after a tight sideways range', () => {
    const flat: [number, number][] = Array.from({ length: 10 }, (_, k) => [k * 3, k % 2 ? 101.5 : 99.5]);
    const c = path([...flat, [30, 100], [36, 108], [40, 109]]);
    expect(detectPatterns(c).some((p) => p.kind === 'breakoutUp')).toBe(true);
  });
  it('a plain trend is not a pattern', () => {
    expect(detectPatterns(path([[0, 100], [80, 160]]))).toEqual([]);
  });
  it('never looks ahead: patterns confirmed before candle n are identical with or without later candles', () => {
    const c = path([[0, 90], [15, 110], [25, 100], [35, 110], [50, 92], [70, 80], [90, 95]]);
    const full = detectPatterns(c);
    for (const p of full) {
      const cut = detectPatterns(c.slice(0, p.confirmAt + 1));
      expect(cut.find((x) => x.kind === p.kind && x.confirmAt === p.confirmAt)).toEqual(p);
    }
  });
  it('outcome: target reached vs failed', () => {
    const c = path([[0, 90], [15, 110], [25, 100], [35, 110], [50, 92], [60, 80]]);
    const dt = detectPatterns(c).find((p) => p.kind === 'doubleTop')!;
    expect(outcomeOf(dt, c)).toBe('reached');
    const bounce = path([[0, 90], [15, 110], [25, 100], [35, 110], [42, 99], [55, 115], [100, 116]]);
    const dt2 = detectPatterns(bounce).find((p) => p.kind === 'doubleTop');
    if (dt2) expect(outcomeOf(dt2, bounce)).toBe('failed');
  });
});

describe('auto support / resistance', () => {
  it('finds a level touched several times below price, and resistance above', () => {
    const c = path([[0, 110], [8, 100], [16, 110], [24, 100], [32, 112], [40, 100], [48, 108]]);
    const lv = autoLevels(c);
    const sup = lv.find((l) => l.kind === 'support')!;
    expect(sup.p).toBeGreaterThan(99);
    expect(sup.p).toBeLessThan(100.5);
    expect(sup.touches).toBeGreaterThanOrEqual(2);
    expect(lv.some((l) => l.kind === 'resistance' && l.p > 108)).toBe(true);
  });
});

import { SCENARIOS, generateCandles } from '../data/scenarios';
import { fundamentalsAt } from '../data/fundamentals';

describe('v2 markets carry their signature pattern', () => {
  const cases: [number, string, string[], number, number][] = [
    [1, 'dot-com double top', ['doubleTop', 'hs'], 150, 180],
    [2, '2008 head & shoulders', ['hs', 'doubleTop'], 98, 122],
    [3, '2020 double bottom', ['doubleBottom', 'ihs'], 128, 160],
    [4, 'crypto double top', ['doubleTop', 'hs'], 128, 165],
  ];
  for (const [id, name, kinds, lo, hi] of cases) {
    it(`${name}: found in at least 16 of 20 seeds`, () => {
      let ok = 0;
      for (let seed = 1; seed <= 20; seed++) {
        const ps = detectPatterns(generateCandles(SCENARIOS[id - 1], seed, 2));
        if (ps.some((p) => kinds.includes(p.kind) && p.confirmAt >= lo && p.confirmAt <= hi)) ok++;
      }
      expect(ok).toBeGreaterThanOrEqual(16);
    });
  }
  it('v2 keeps each story: dot-com and crypto collapse, 2020 recovers, all 200 candles valid', () => {
    for (const sc of SCENARIOS) {
      const c = generateCandles(sc, 9, 2);
      expect(c).toHaveLength(200);
      expect(c.every((k) => k.low > 0 && k.high >= Math.max(k.open, k.close) && k.low <= Math.min(k.open, k.close))).toBe(true);
    }
    const peakDrop = (id: number) => { const c = generateCandles(SCENARIOS[id - 1], 9, 2); return c[199].close / Math.max(...c.map((k) => k.close)); };
    expect(peakDrop(1)).toBeLessThan(0.55);
    expect(peakDrop(4)).toBeLessThan(0.4);
    const c3 = generateCandles(SCENARIOS[2], 9, 2);
    expect(c3[199].close).toBeGreaterThan(c3[120].close * 1.3);
    expect(fundamentalsAt(1, generateCandles(SCENARIOS[0], 9, 2), 139).valuation).toBe('extreme');
  });
  it('v1 (saved rounds) is untouched', () => {
    expect(generateCandles(SCENARIOS[0], 7)[150].close.toFixed(4)).toBe('280.5610');
  });
});
