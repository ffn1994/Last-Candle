import { describe, expect, it } from 'vitest';
import {
  eventWithin, fearGreed, fundamentalsAt, lerpKeys, moodOf, scheduledEvents, stepKeys, upcoming, valuationOf,
} from './fundamentals';
import { SCENARIOS, generateCandles } from './scenarios';

describe('keyframes', () => {
  it('interpolates linearly and steps', () => {
    expect(lerpKeys([[0, 1], [10, 3]], 5)).toBe(2);
    expect(lerpKeys([[0, 1], [10, 3]], 20)).toBe(3);
    expect(stepKeys([[0, 5], [10, 6], [20, 7]], 15)).toBe(6);
    expect(stepKeys([[0, 5], [10, 6]], 9)).toBe(5);
  });
});

describe('labels', () => {
  it('valuation and mood buckets', () => {
    expect(valuationOf(null)).toBeNull();
    expect(valuationOf(10)).toBe('cheap');
    expect(valuationOf(16)).toBe('fair');
    expect(valuationOf(30)).toBe('high');
    expect(valuationOf(60)).toBe('extreme');
    expect(moodOf(10)).toBe('extremeFear');
    expect(moodOf(50)).toBe('neutral');
    expect(moodOf(90)).toBe('extremeGreed');
  });
});

describe('scenario fundamentals tell the right story', () => {
  const at = (id: number, i: number) => fundamentalsAt(id, generateCandles(SCENARIOS[id - 1], 11), i);
  it('dot-com: valuation goes extreme near the top', () => {
    expect(at(1, 60).valuation).not.toBe('extreme');
    expect(at(1, 140).valuation).toBe('extreme');
    expect(at(1, 199).pe!).toBeLessThan(at(1, 140).pe! / 1.6);
  });
  it('2008: rates cut, unemployment up', () => {
    expect(at(2, 190).rate).toBeLessThan(at(2, 60).rate);
    expect(at(2, 190).unemployment!).toBeGreaterThan(at(2, 60).unemployment! + 3);
  });
  it('crypto has no earnings or P/E', () => {
    expect(at(4, 100).pe).toBeNull();
    expect(scheduledEvents(4, generateCandles(SCENARIOS[3], 11)).some((e) => e.kind === 'earnings')).toBe(false);
  });
  it('fear & greed: greed in a rally, fear in a crash', () => {
    const c = generateCandles(SCENARIOS[2], 11); // 2020: crash 100–125
    expect(fearGreed(c, 99)).toBeGreaterThan(55);
    expect(['fear', 'extremeFear']).toContain(moodOf(fearGreed(c, 124)));
    expect(fearGreed(c, 124)).toBeLessThan(fearGreed(c, 99) - 25);
  });
});

describe('scheduled events', () => {
  for (const sc of SCENARIOS) {
    it(`${sc.id}: no two events (or news) on the same candle, all inside the round`, () => {
      const c = generateCandles(sc, 3);
      const ev = scheduledEvents(sc.id, c);
      // rate decisions announced by a news card share its candle on purpose
      const ats = [...ev.filter((e) => !e.viaNews).map((e) => e.at), ...sc.news.map((n) => n.at)];
      expect(new Set(ats).size).toBe(ats.length);
      expect(ev.every((e) => e.at >= 60 && e.at < 199)).toBe(true);
    });
  }
  it('earnings surprise agrees with the next 3 candles', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const c = generateCandles(SCENARIOS[0], seed);
      for (const e of scheduledEvents(1, c).filter((x) => x.kind === 'earnings')) {
        const move = c[e.at + 3].close / c[e.at].close - 1;
        expect(Math.sign(e.surprise!)).toBe(Math.sign(move));
        expect(e.actual / e.expected!).toBeCloseTo(1 + e.surprise!);
      }
    }
  });
  it('calendar shows upcoming events only, and flags imminent ones', () => {
    const ev = scheduledEvents(1, generateCandles(SCENARIOS[0], 3));
    const up = upcoming(ev, 85, 15);
    expect(up.every((e) => e.at > 85 && e.at <= 100)).toBe(true);
    expect(eventWithin(ev, 89, 3)).toBe(true); // rate decision on 92
    expect(eventWithin(ev, 60, 3)).toBe(false);
  });
  it('prints the story (for review)', () => {
    for (const sc of SCENARIOS) {
      const c = generateCandles(sc, 11);
      const row = [60, 100, 140, 180].map((i) => { const f = fundamentalsAt(sc.id, c, i); return `${i}: PE ${f.pe?.toFixed(0) ?? '—'} r ${f.rate} fg ${f.fearGreed}`; });
      console.log(sc.id, row.join(' | '));
    }
  });
});

import { closeTrade, newRound, openTrade } from '../game/engine';
import { computeStats } from '../game/scoring';
import { lessonsFor } from '../game/lessons';

describe('fundamental lessons', () => {
  const base = () => newRound({ scenarioId: 1, mode: 'normal', seed: 1, daily: false });
  it('flags a losing long bought at an extreme valuation', () => {
    let s = openTrade(base(), { side: 'long', riskPct: 1, stop: 95, tp: null, pe: 60 }, 100, 2);
    s = closeTrade(s, 97, 'manual');
    const st = computeStats(s);
    expect(st.overvaluedLosses).toBe(1);
    expect(lessonsFor(st, 0).some((l) => l.includes('مبالغ فيه'))).toBe(true);
  });
  it('flags big risk right before a scheduled event, not small risk', () => {
    let s = openTrade(base(), { side: 'long', riskPct: 2, stop: 95, tp: null, eventSoon: true }, 100, 2);
    s = closeTrade(s, 101, 'manual');
    s = openTrade(s, { side: 'long', riskPct: 1, stop: 95, tp: null, eventSoon: true }, 100, 2);
    s = closeTrade(s, 101, 'manual');
    const st = computeStats(s);
    expect(st.eventRiskTrades).toBe(1);
    expect(lessonsFor(st, 0).some((l) => l.includes('قبل حدث مهم'))).toBe(true);
  });
});
