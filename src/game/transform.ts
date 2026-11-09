/** Pure candle transforms for display: weekly aggregation and Heikin Ashi. */
import type { Candle } from './types';

export const WEEK = 5; // trading days per weekly candle

/**
 * Group daily candles into weeks of 5 (the last week may be partial and keeps
 * updating while it forms). A weekly candle keeps the time of its first day,
 * so the time axis still shows day numbers.
 */
export function toWeekly(days: Candle[]): Candle[] {
  const out: Candle[] = [];
  for (let k = 0; k < days.length; k += WEEK) {
    const w = days.slice(k, k + WEEK);
    out.push({
      time: w[0].time,
      open: w[0].open,
      high: Math.max(...w.map((c) => c.high)),
      low: Math.min(...w.map((c) => c.low)),
      close: w[w.length - 1].close,
      volume: w.every((c) => c.volume === undefined) ? undefined : w.reduce((a, c) => a + (c.volume ?? 0), 0),
    });
  }
  return out;
}

/** Heikin Ashi: smoothed candles that make trends easier to read (prices are synthetic). */
export function heikinAshi(cs: Candle[]): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    const close = (c.open + c.high + c.low + c.close) / 4;
    const open = i === 0 ? (c.open + c.close) / 2 : (out[i - 1].open + out[i - 1].close) / 2;
    out.push({ time: c.time, open, close, high: Math.max(c.high, open, close), low: Math.min(c.low, open, close), volume: c.volume });
  }
  return out;
}
