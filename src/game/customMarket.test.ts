import { describe, expect, it } from 'vitest';
import {
  CHUNK, LEN, MAX_MULT, START_PRICE, TEMPLATES, applyStroke, flatPath, fromWaypoints, nextCustomId, smooth, toScenario,
  type CustomMarket,
} from './customMarket';
import { generateCandles, getScenario, registerCustomScenario } from '../data/scenarios';
import { fundamentalsAt, scheduledEvents } from '../data/fundamentals';

const market = (path: number[], vol: CustomMarket['vol'] = 'normal'): CustomMarket => ({ id: 1000, name: 'سوقي', path, vol, createdAt: 0 });

describe('drawing the trend', () => {
  it('a stroke sets every candle it crosses, in either direction', () => {
    let p = applyStroke(flatPath(), 10, 1, 20, 2);
    expect(p[10]).toBeCloseTo(1);
    expect(p[20]).toBeCloseTo(2);
    expect(p[15]).toBeCloseTo(Math.SQRT2); // log interpolation
    p = applyStroke(p, 20, 0.5, 10, 0.5); // drawing back over it replaces it
    expect(p.slice(10, 21).every((v) => Math.abs(v - 0.5) < 1e-9)).toBe(true);
    expect(p[9]).toBe(1);
  });
  it('values are clamped to the chart range', () => {
    expect(applyStroke(flatPath(), 0, 10, 5, 10)[3]).toBe(MAX_MULT);
  });
  it('smoothing removes jitter but keeps the ends and the level', () => {
    const jitter = flatPath().map((_, i) => (i % 2 ? 1.1 : 0.9));
    const s = smooth(jitter);
    expect(Math.max(...s.slice(5, 195)) - Math.min(...s.slice(5, 195))).toBeLessThan(0.05);
    expect(s[0]).toBe(0.9);
  });
  it('templates have the full length', () => {
    for (const t of Object.values(TEMPLATES)) expect(t()).toHaveLength(LEN);
  });
});

describe('the drawing becomes a market', () => {
  it('generated closes land exactly on the drawing every 10 candles', () => {
    const path = fromWaypoints([[0, 1], [100, 2], [199, 0.8]]);
    const c = generateCandles(toScenario(market(path)), 5);
    expect(c).toHaveLength(LEN);
    for (let k = CHUNK - 1; k < LEN; k += CHUNK) expect(c[k].close).toBeCloseTo(START_PRICE * path[k], 6);
  });
  it('wild markets are noisier than calm ones', () => {
    const noise = (vol: CustomMarket['vol']) => {
      const c = generateCandles(toScenario(market(flatPath(), vol)), 3);
      return c.reduce((a, k) => a + (k.high - k.low) / k.close, 0) / c.length;
    };
    expect(noise('wild')).toBeGreaterThan(noise('calm') * 2.5);
  });
  it('is found by id once registered, with neutral fundamentals and no events', () => {
    const sc = toScenario(market(TEMPLATES.bubble()));
    registerCustomScenario(sc);
    expect(getScenario(1000).name).toBe('سوقي');
    const c = generateCandles(sc, 1);
    expect(fundamentalsAt(1000, c, 100).pe).toBeNull();
    expect(scheduledEvents(1000, c).every((e) => e.kind !== 'earnings')).toBe(true);
  });
  it('ids are unique and above the built-in markets', () => {
    expect(nextCustomId([])).toBe(1000);
    expect(nextCustomId([market(flatPath()), { ...market(flatPath()), id: 1004 }])).toBe(1005);
  });
});
