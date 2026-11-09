/**
 * Classical chart analysis (pure): pivots, automatic support/resistance and
 * recognition of completed patterns. Only candles passed in are used, so
 * calling it with the candles up to "now" can never peek into the future.
 */
import type { Candle } from './types';

export interface Pivot { i: number; p: number; kind: 'H' | 'L' }

/**
 * Swing highs/lows: a candle whose high (low) is the extreme of the k candles
 * on each side. Consecutive pivots of the same kind collapse to the extreme one,
 * so the list alternates H, L, H, L…
 */
export function pivots(c: Candle[], k = 4): Pivot[] {
  const raw: Pivot[] = [];
  for (let i = k; i < c.length - k; i++) {
    let hi = true;
    let lo = true;
    for (let j = i - k; j <= i + k; j++) {
      if (j === i) continue;
      // ties (a candle opening at the previous close shares its high/low): the first one counts
      if (j < i ? c[j].high >= c[i].high : c[j].high > c[i].high) hi = false;
      if (j < i ? c[j].low <= c[i].low : c[j].low < c[i].low) lo = false;
    }
    if (hi) raw.push({ i, p: c[i].high, kind: 'H' });
    if (lo) raw.push({ i, p: c[i].low, kind: 'L' });
  }
  const out: Pivot[] = [];
  for (const pv of raw) {
    const last = out[out.length - 1];
    if (last && last.kind === pv.kind) {
      if ((pv.kind === 'H' && pv.p > last.p) || (pv.kind === 'L' && pv.p < last.p)) out[out.length - 1] = pv;
    } else out.push(pv);
  }
  return out;
}

// ------------------------------------------------------------ support / resistance

export interface Level { p: number; touches: number; kind: 'support' | 'resistance' }

/**
 * Cluster pivot prices that sit within `tol` of each other; the more touches,
 * the stronger the level. Returns the nearest `n` supports below and
 * resistances above the current price.
 */
export function autoLevels(c: Candle[], n = 2, tol = 0.015): Level[] {
  if (c.length < 12) return [];
  const price = c[c.length - 1].close;
  const clusters: { sum: number; count: number }[] = [];
  for (const pv of pivots(c, 3)) {
    const hit = clusters.find((cl) => Math.abs(cl.sum / cl.count - pv.p) / pv.p <= tol);
    if (hit) { hit.sum += pv.p; hit.count++; } else clusters.push({ sum: pv.p, count: 1 });
  }
  const levels = clusters.map((cl) => ({ p: cl.sum / cl.count, touches: cl.count }));
  // prefer levels touched at least twice; fall back to single pivots
  const pick = (side: 'support' | 'resistance') => {
    const cand = levels.filter((l) => (side === 'support' ? l.p < price : l.p > price));
    const strong = cand.filter((l) => l.touches >= 2);
    const pool = strong.length ? strong : cand;
    return pool
      .sort((a, b) => Math.abs(a.p - price) - Math.abs(b.p - price))
      .slice(0, n)
      .map((l) => ({ ...l, kind: side }));
  };
  return [...pick('support'), ...pick('resistance')];
}

// ------------------------------------------------------------ patterns

export type PatternKind = 'doubleTop' | 'doubleBottom' | 'hs' | 'ihs' | 'breakoutUp' | 'breakoutDown';

export interface Pattern {
  kind: PatternKind;
  dir: 'up' | 'down'; // expected move after confirmation
  confirmAt: number; // candle whose close broke the neckline / range
  start: number; // first candle of the formation
  neckline: number; // price of the neckline / range edge at confirmation
  target: number; // measured-move target
  extreme: number; // pattern high (for tops) / low (for bottoms): invalidation level
}

const PRIORITY: Record<PatternKind, number> = { hs: 3, ihs: 3, doubleTop: 2, doubleBottom: 2, breakoutUp: 1, breakoutDown: 1 };

/** First candle after `from` (within `within`) whose close crosses the line, unless the pattern is invalidated first. */
function confirmation(
  c: Candle[], from: number, line: (i: number) => number, dir: 'up' | 'down', invalid: number, within = 25,
): number | null {
  for (let j = from + 1; j < c.length && j <= from + within; j++) {
    if (dir === 'down') {
      if (c[j].close > invalid) return null;
      if (c[j].close < line(j)) return j;
    } else {
      if (c[j].close < invalid) return null;
      if (c[j].close > line(j)) return j;
    }
  }
  return null;
}

function doubles(c: Candle[], pv: Pivot[]): Pattern[] {
  const out: Pattern[] = [];
  for (let s = 0; s + 2 < pv.length; s++) {
    const [a, m, b] = [pv[s], pv[s + 1], pv[s + 2]];
    if (a.kind !== b.kind || b.i - a.i < 6) continue;
    const top = a.kind === 'H';
    const peak = top ? Math.max(a.p, b.p) : Math.min(a.p, b.p);
    const near = Math.abs(a.p - b.p) / peak <= 0.04;
    const depth = Math.abs(peak - m.p) / peak;
    if (!near || depth < 0.03) continue;
    const dir = top ? 'down' : 'up';
    const j = confirmation(c, b.i, () => m.p, dir, top ? peak * 1.01 : peak * 0.99);
    if (j === null) continue;
    out.push({
      kind: top ? 'doubleTop' : 'doubleBottom', dir, confirmAt: j, start: a.i,
      neckline: m.p, target: top ? m.p - (peak - m.p) : m.p + (m.p - peak), extreme: peak,
    });
  }
  return out;
}

function headShoulders(c: Candle[], pv: Pivot[]): Pattern[] {
  const out: Pattern[] = [];
  for (let s = 0; s + 4 < pv.length; s++) {
    const [l, t1, h, t2, r] = pv.slice(s, s + 5);
    if (l.kind !== h.kind || h.kind !== r.kind) continue;
    const top = h.kind === 'H';
    const sign = top ? 1 : -1;
    // head beyond both shoulders, shoulders roughly level
    if (sign * (h.p - l.p) / h.p < 0.02 || sign * (h.p - r.p) / h.p < 0.02) continue;
    if (Math.abs(l.p - r.p) / h.p > 0.05) continue;
    const neck = (i: number) => t1.p + ((t2.p - t1.p) * (i - t1.i)) / (t2.i - t1.i);
    const dir = top ? 'down' : 'up';
    const j = confirmation(c, r.i, neck, dir, top ? h.p : h.p);
    if (j === null) continue;
    const height = Math.abs(h.p - neck(h.i));
    out.push({
      kind: top ? 'hs' : 'ihs', dir, confirmAt: j, start: l.i,
      neckline: neck(j), target: top ? neck(j) - height : neck(j) + height, extreme: h.p,
    });
  }
  return out;
}

/** A tight sideways range of `w` candles, then a close beyond it. */
function breakouts(c: Candle[], w = 15): Pattern[] {
  const out: Pattern[] = [];
  let lastAt = -Infinity;
  for (let j = w; j < c.length; j++) {
    const win = c.slice(j - w, j);
    const hi = Math.max(...win.map((x) => x.high));
    const lo = Math.min(...win.map((x) => x.low));
    const mid = (hi + lo) / 2;
    const range = hi - lo;
    const tight = range / mid <= 0.07;
    // sideways: the window's opening and closing stretches sit at about the same level
    const avg = (xs: Candle[]) => xs.reduce((t, x) => t + x.close, 0) / xs.length;
    const sideways = Math.abs(avg(win.slice(-5)) - avg(win.slice(0, 5))) <= range * 0.5;
    if (!tight || !sideways || j - lastAt < 10) continue;
    if (c[j].close > hi) {
      out.push({ kind: 'breakoutUp', dir: 'up', confirmAt: j, start: j - w, neckline: hi, target: hi + range, extreme: lo });
      lastAt = j;
    } else if (c[j].close < lo) {
      out.push({ kind: 'breakoutDown', dir: 'down', confirmAt: j, start: j - w, neckline: lo, target: lo - range, extreme: hi });
      lastAt = j;
    }
  }
  return out;
}

/** Every pattern confirmed within the given candles, overlaps resolved in favour of the stronger pattern. */
export function detectPatterns(c: Candle[]): Pattern[] {
  if (c.length < 20) return [];
  const pv = pivots(c, 4);
  const all = [...headShoulders(c, pv), ...doubles(c, pv), ...breakouts(c)]
    .sort((a, b) => PRIORITY[b.kind] - PRIORITY[a.kind] || a.confirmAt - b.confirmAt);
  const kept: Pattern[] = [];
  for (const p of all) {
    // one pattern per direction within 6 candles; the stronger one was added first
    if (kept.some((k) => k.dir === p.dir && Math.abs(k.confirmAt - p.confirmAt) <= 6)) continue;
    kept.push(p);
  }
  return kept.sort((a, b) => a.confirmAt - b.confirmAt);
}

// ------------------------------------------------------------ review

export type Outcome = 'reached' | 'failed' | 'open';

/** Did price reach the target (within 40 candles) before closing back beyond the pattern's extreme? */
export function outcomeOf(p: Pattern, c: Candle[]): Outcome {
  for (let j = p.confirmAt + 1; j < c.length && j <= p.confirmAt + 40; j++) {
    if (p.dir === 'down') {
      if (c[j].low <= p.target) return 'reached';
      if (c[j].close > p.extreme) return 'failed';
    } else {
      if (c[j].high >= p.target) return 'reached';
      if (c[j].close < p.extreme) return 'failed';
    }
  }
  return p.confirmAt + 40 < c.length ? 'failed' : 'open';
}
