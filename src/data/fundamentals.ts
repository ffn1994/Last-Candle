/**
 * Fundamental data for each scenario: earnings, valuation, interest rates,
 * inflation, unemployment and a fear/greed index, plus scheduled events
 * (earnings reports, rate decisions, inflation releases).
 *
 * Everything is derived from the scenario profile and the generated candles,
 * so prices never change (saved rounds stay valid) and the numbers always
 * agree with what the market does. Pure and deterministic.
 */
import type { Candle } from '../game/types';
import { getScenario } from './scenarios';
import { isCustomId } from '../game/customMarket';

type Keys = [index: number, value: number][];

export interface MacroProfile {
  /** false for assets without earnings (crypto): no P/E, no earnings reports */
  hasEarnings: boolean;
  /** trailing-12-month earnings per share, linear between keyframes */
  eps: Keys;
  /** policy rate: step changes on decision days (keyframe index > 0) */
  rate: Keys;
  inflation: Keys;
  unemployment: Keys;
}

/** Modeled on the real episodes; numbers are plausible, not historical records. */
export const PROFILES: Record<number, MacroProfile> = {
  // dot-com: earnings barely grow while the price triples → valuation explodes
  1: {
    hasEarnings: true,
    eps: [[0, 4.4], [140, 4.8], [199, 4.0]],
    rate: [[0, 5.5], [92, 6.0], [122, 6.5], [178, 6.0]],
    inflation: [[0, 2.7], [120, 3.6], [199, 3.1]],
    unemployment: [[0, 4.1], [150, 4.0], [199, 4.8]],
  },
  // 2008: earnings collapse during the crash, rates cut to zero
  2: {
    hasEarnings: true,
    eps: [[0, 6.1], [90, 5.8], [160, 2.6], [199, 3.0]],
    rate: [[0, 5.25], [85, 4.75], [112, 3.5], [130, 2.0], [150, 1.0], [175, 0.25]],
    inflation: [[0, 3.2], [100, 4.6], [160, 1.0], [199, 0.2]],
    unemployment: [[0, 4.7], [110, 5.6], [170, 7.8], [199, 9.4]],
  },
  // 2020: shock to earnings and jobs, emergency cuts, fast recovery
  3: {
    hasEarnings: true,
    eps: [[0, 15.2], [100, 16.0], [140, 13.4], [199, 15.1]],
    rate: [[0, 1.75], [105, 1.25], [120, 0.25]],
    inflation: [[0, 2.2], [110, 2.1], [140, 0.4], [199, 1.3]],
    unemployment: [[0, 3.6], [110, 3.5], [135, 14.2], [199, 8.1]],
  },
  // crypto: no earnings at all — price is pure speculation
  4: {
    hasEarnings: false,
    eps: [],
    rate: [[0, 0.25], [170, 0.5], [190, 1.0]],
    inflation: [[0, 1.8], [120, 5.0], [199, 7.0]],
    unemployment: [[0, 6.2], [199, 4.0]],
  },
  // the boring market: fair value, steady data
  5: {
    hasEarnings: true,
    eps: [[0, 3.1], [199, 3.25]],
    rate: [[0, 3.0], [90, 3.25], [150, 3.25]],
    inflation: [[0, 2.4], [199, 2.6]],
    unemployment: [[0, 5.0], [199, 4.9]],
  },
};

/** Player-designed markets: no earnings, steady macro backdrop. */
export const CUSTOM_PROFILE: MacroProfile = {
  hasEarnings: false,
  eps: [],
  rate: [[0, 3.0]],
  inflation: [[0, 2.5]],
  unemployment: [[0, 5.0]],
};

export const profileFor = (scenarioId: number) => PROFILES[scenarioId] ?? CUSTOM_PROFILE;

/** Linear interpolation between keyframes, flat outside them. */
export function lerpKeys(keys: Keys, i: number): number {
  if (!keys.length) return NaN;
  if (i <= keys[0][0]) return keys[0][1];
  for (let k = 1; k < keys.length; k++) {
    const [i1, v1] = keys[k];
    if (i <= i1) {
      const [i0, v0] = keys[k - 1];
      return v0 + ((v1 - v0) * (i - i0)) / (i1 - i0);
    }
  }
  return keys[keys.length - 1][1];
}

/** Step function: the value of the last keyframe at or before i. */
export function stepKeys(keys: Keys, i: number): number {
  let v = keys[0]?.[1] ?? NaN;
  for (const [ki, kv] of keys) if (ki <= i) v = kv;
  return v;
}

export type Valuation = 'cheap' | 'fair' | 'high' | 'extreme';
export const LONG_RUN_PE = 16;

export function valuationOf(pe: number | null): Valuation | null {
  if (pe === null) return null;
  if (pe < 12) return 'cheap';
  if (pe <= 22) return 'fair';
  if (pe <= 35) return 'high';
  return 'extreme';
}

export type Mood = 'extremeFear' | 'fear' | 'neutral' | 'greed' | 'extremeGreed';
export function moodOf(fg: number): Mood {
  return fg < 25 ? 'extremeFear' : fg < 45 ? 'fear' : fg <= 55 ? 'neutral' : fg <= 75 ? 'greed' : 'extremeGreed';
}

/**
 * Fear & greed 0–100 from the price itself: 20-candle momentum measured in
 * units of recent volatility, pulled down by the drawdown from the 60-candle high.
 */
export function fearGreed(candles: Candle[], index: number): number {
  const from = Math.max(1, index - 19);
  const rets: number[] = [];
  for (let i = from; i <= index; i++) rets.push(Math.log(candles[i].close / candles[i - 1].close));
  if (rets.length < 2) return 50;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length) || 1e-9;
  const z = rets.reduce((a, b) => a + b, 0) / (sd * Math.sqrt(rets.length));
  let high = 0;
  for (let i = Math.max(0, index - 59); i <= index; i++) high = Math.max(high, candles[i].high);
  const dd = (high - candles[index].close) / high;
  // both parts are capped so the index reaches its extremes only in real panics / manias
  const momentum = 12 * Math.max(-3, Math.min(3, z));
  return Math.round(Math.max(0, Math.min(100, 50 + momentum - Math.min(16, 60 * dd))));
}

// ---------------------------------------------------------------- events

export type EventKind = 'earnings' | 'rate' | 'cpi';

export interface ScheduledEvent {
  id: string; // `${kind}:${at}`
  at: number; // candle index on which it is released (after that candle closes)
  kind: EventKind;
  /** what everyone knows beforehand (shown in the calendar) */
  expected: number | null;
  previous: number | null;
  /** released value */
  actual: number;
  /** earnings only: surprise vs expectations, e.g. 0.08 = 8% better */
  surprise?: number;
  /** blocking events pause the game with a card; others show a short notice */
  blocking: boolean;
  /** a scripted news card on the same candle already announces it (no second card) */
  viaNews?: boolean;
}

const EARNINGS_AT = [70, 110, 150, 190];
const CPI_FIRST = 75;
const CPI_EVERY = 25;

/**
 * All scheduled events of a round. Earnings surprises follow the price
 * reaction over the next 3 candles (like real post-earnings moves), so
 * reading reports is genuinely useful.
 */
export function scheduledEvents(scenarioId: number, candles: Candle[]): ScheduledEvent[] {
  const prof = profileFor(scenarioId);
  const news = new Set(getScenario(scenarioId).news.map((n) => n.at));
  const taken = new Set<number>(news);
  const last = candles.length - 1;
  const out: ScheduledEvent[] = [];
  const free = (i: number) => { while (taken.has(i) && i < last) i++; taken.add(i); return i; };

  for (let k = 1; k < prof.rate.length; k++) {
    const at = prof.rate[k][0];
    taken.add(at);
    out.push({
      id: `rate:${at}`, at, kind: 'rate', expected: null,
      previous: prof.rate[k - 1][1], actual: prof.rate[k][1], blocking: true, viaNews: news.has(at),
    });
  }

  if (prof.hasEarnings) {
    for (const base of EARNINGS_AT) {
      const at = free(base);
      if (at >= last) continue;
      const after = candles[Math.min(last, at + 3)].close;
      const surprise = Math.max(-0.25, Math.min(0.25, (after / candles[at].close - 1) * 2));
      const actual = lerpKeys(prof.eps, at) / 4; // quarterly EPS
      const prevQ = lerpKeys(prof.eps, Math.max(0, at - 40)) / 4;
      out.push({
        id: `earnings:${at}`, at, kind: 'earnings',
        expected: actual / (1 + surprise), previous: prevQ, actual, surprise, blocking: true,
      });
    }
  }

  for (let base = CPI_FIRST; base < last; base += CPI_EVERY) {
    const at = free(base);
    if (at >= last) continue;
    out.push({
      id: `cpi:${at}`, at, kind: 'cpi', expected: null,
      previous: lerpKeys(prof.inflation, at - CPI_EVERY), actual: lerpKeys(prof.inflation, at), blocking: false,
    });
  }
  return out.sort((a, b) => a.at - b.at);
}

export const upcoming = (events: ScheduledEvent[], index: number, horizon = 15) =>
  events.filter((e) => e.at > index && e.at <= index + horizon);

/** A scheduled event is released within the next `n` candles. */
export const eventWithin = (events: ScheduledEvent[], index: number, n = 3) =>
  events.some((e) => e.blocking && e.at > index && e.at <= index + n);

// ---------------------------------------------------------------- snapshot

export interface Fundamentals {
  pe: number | null;
  epsTtm: number | null;
  epsGrowth: number | null; // vs 60 candles earlier, e.g. 0.05 = +5%
  rate: number;
  inflation: number;
  unemployment: number;
  fearGreed: number;
  valuation: Valuation | null;
  mood: Mood;
  custom: boolean; // player-designed market: no real fundamentals behind it
}

export function fundamentalsAt(scenarioId: number, candles: Candle[], index: number): Fundamentals {
  const prof = profileFor(scenarioId);
  const price = candles[index].close;
  const eps = prof.hasEarnings ? lerpKeys(prof.eps, index) : null;
  const epsPrev = prof.hasEarnings ? lerpKeys(prof.eps, Math.max(0, index - 60)) : null;
  const pe = eps && eps > 0 ? price / eps : null;
  const fg = fearGreed(candles, index);
  return {
    pe,
    epsTtm: eps,
    epsGrowth: eps !== null && epsPrev ? eps / epsPrev - 1 : null,
    rate: stepKeys(prof.rate, index),
    inflation: lerpKeys(prof.inflation, index),
    unemployment: lerpKeys(prof.unemployment, index),
    fearGreed: fg,
    valuation: valuationOf(pe),
    mood: moodOf(fg),
    custom: isCustomId(scenarioId),
  };
}
