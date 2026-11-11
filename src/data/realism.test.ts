import { describe, expect, it } from 'vitest';
import { SCENARIOS, generateCandles } from './scenarios';
import { detectPatterns } from '../game/patterns';
import { CHUNK, LEN, START_PRICE, TEMPLATES, toScenario } from '../game/customMarket';

const rets = (gen: number, seeds = 30) => {
  const out: number[] = [];
  for (let seed = 1; seed <= seeds; seed++) {
    // the boring market: constant regime, so statistics reflect the noise model itself
    const c = generateCandles(SCENARIOS[4], seed, gen);
    for (let i = 1; i < c.length; i++) out.push(Math.log(c[i].close / c[i - 1].close));
  }
  return out;
};
const kurtosis = (x: number[]) => {
  const m = x.reduce((a, b) => a + b, 0) / x.length;
  const v = x.reduce((a, b) => a + (b - m) ** 2, 0) / x.length;
  return x.reduce((a, b) => a + (b - m) ** 4, 0) / x.length / v ** 2;
};
const absAutocorr = (seeds = 30) => {
  let num = 0, den = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const c = generateCandles(SCENARIOS[4], seed, 3);
    const a = c.slice(1).map((k, i) => Math.abs(Math.log(k.close / c[i].close)));
    const m = a.reduce((x, y) => x + y, 0) / a.length;
    for (let i = 1; i < a.length; i++) num += (a[i] - m) * (a[i - 1] - m);
    for (let i = 0; i < a.length; i++) den += (a[i] - m) ** 2;
  }
  return num / den;
};

describe('generator v3: realistic price motion', () => {
  it('fat tails: kurtosis well above a bell curve (3), unlike v1', () => {
    expect(kurtosis(rets(1))).toBeLessThan(3.6);
    const k = kurtosis(rets(3));
    expect(k).toBeGreaterThan(4.5);
    expect(k).toBeLessThan(25); // real daily stock returns: roughly 5–20
  });
  it('volatility clusters: big days follow big days', () => {
    expect(absAutocorr()).toBeGreaterThan(0.08);
  });
  it('every candle is valid and the story still holds', () => {
    for (const sc of SCENARIOS) for (const seed of [1, 2, 3]) {
      const c = generateCandles(sc, seed, 3);
      expect(c).toHaveLength(200);
      for (const k of c) {
        expect(k.low).toBeGreaterThan(0);
        expect(k.high).toBeGreaterThanOrEqual(Math.max(k.open, k.close));
        expect(k.low).toBeLessThanOrEqual(Math.min(k.open, k.close));
      }
    }
    const dot = generateCandles(SCENARIOS[0], 4, 3);
    expect(dot[199].close / Math.max(...dot.map((k) => k.close))).toBeLessThan(0.6);
  });
  it('designed markets still land exactly on the drawing', () => {
    const path = TEMPLATES.bubble();
    const c = generateCandles(toScenario({ id: 1000, name: 'x', path, vol: 'wild', createdAt: 0 }), 5, 3);
    for (let k = CHUNK - 1; k < LEN; k += CHUNK) expect(c[k].close).toBeCloseTo(START_PRICE * path[k], 6);
  });
  it('signature patterns survive the extra realism (at least 14 of 20 seeds each)', () => {
    const cases: [number, string[], number, number][] = [
      [1, ['doubleTop', 'hs'], 150, 180], [2, ['hs', 'doubleTop'], 98, 122],
      [3, ['doubleBottom', 'ihs'], 128, 160], [4, ['doubleTop', 'hs'], 128, 165],
    ];
    const rates: string[] = [];
    for (const [id, kinds, lo, hi] of cases) {
      let ok = 0;
      for (let seed = 1; seed <= 20; seed++) {
        if (detectPatterns(generateCandles(SCENARIOS[id - 1], seed, 3)).some((p) => kinds.includes(p.kind) && p.confirmAt >= lo && p.confirmAt <= hi)) ok++;
      }
      rates.push(`${id}:${ok}`);
      expect(ok, rates.join(' ')).toBeGreaterThanOrEqual(14);
    }
  });
});
