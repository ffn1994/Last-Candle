import { describe, expect, it } from 'vitest';
import { HISTORICAL, historicalMonths, isHistoricalId, monthEnd, monthStart } from './historical';
import { generateCandles, getScenario } from './scenarios';
import { fundamentalsAt, scheduledEvents } from './fundamentals';

describe('historical markets (real S&P 500 monthly path)', () => {
  it('six eras of 46 real months each, found by id', () => {
    expect(HISTORICAL).toHaveLength(6);
    for (const sc of HISTORICAL) {
      expect(historicalMonths(sc.id)).toHaveLength(46);
      expect(sc.segments.reduce((a, s) => a + s.len, 0)).toBe(200);
      expect(getScenario(sc.id).name).toBe(sc.name);
      expect(isHistoricalId(sc.id)).toBe(true);
    }
    expect(isHistoricalId(5)).toBe(false);
  });
  it('the candle closing each month lands exactly on the real level', () => {
    for (const sc of HISTORICAL) {
      const months = historicalMonths(sc.id)!;
      const c = generateCandles(sc, 3, 3);
      months.forEach((m, k) => expect(c[monthEnd(k, 46)].close).toBeCloseTo(m.p, 6));
    }
  });
  it('real history checks: 1929 crash, 2008 bottom, dot-com peak', () => {
    const lvl = (id: number, month: string) => historicalMonths(id)!.find((m) => m.m === month)!.p;
    expect(lvl(101, '1932-03') / lvl(101, '1929-09')).toBeLessThan(0.3); // −74% from the 1929 peak
    expect(lvl(105, '2009-03') / lvl(105, '2007-10')).toBeLessThan(0.52);
    expect(Math.max(...historicalMonths(104)!.map((m) => m.p))).toBeGreaterThan(1450);
  });
  it('news sit on the first candle of their real month', () => {
    const fin = getScenario(105);
    const k = historicalMonths(105)!.findIndex((m) => m.m === '2008-09');
    expect(fin.news.some((n) => n.at === monthStart(k, 46) && n.text.includes('إفلاس'))).toBe(true);
    expect(fin.news.every((n) => !n.impact)).toBe(true); // the real prices already contain the reaction
  });
  it('fundamentals are the real ones: P/E, CAPE, inflation, 10-year yield; no invented releases', () => {
    const months = historicalMonths(104)!;
    const c = generateCandles(getScenario(104), 1, 3);
    const k = months.findIndex((m) => m.m === '2000-03');
    const f = fundamentalsAt(104, c, monthEnd(k, 46));
    expect(f.pe!).toBeCloseTo(months[k].p / months[k].e, 1);
    expect(f.cape!).toBeCloseTo(months[k].cape, 1);
    expect(f.cape!).toBeGreaterThan(40); // the dot-com CAPE record
    expect(f.rateKind).toBe('bond10');
    expect(f.rate).toBe(months[k].y);
    expect(f.unemployment).toBeNull();
    expect(scheduledEvents(104, c)).toEqual([]);
    const stag = fundamentalsAt(102, generateCandles(getScenario(102), 1, 3), monthEnd(36, 46));
    expect(stag.inflation).toBeGreaterThan(9); // 1974–75 double-digit inflation
  });
});
