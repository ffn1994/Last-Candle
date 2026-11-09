/**
 * Chart drawings (pure data + geometry). Points are stored as
 * (candle index, price) so they stay on the right candle through pan/zoom
 * and can sit in the empty space to the right of the last candle.
 */
import type { Candle } from './types';

export interface Pt { i: number; p: number }

export type DrawKind = 'hline' | 'trend' | 'ray' | 'rect' | 'fib' | 'text';

interface Base {
  id: string;
  /** Candle index when it was drawn; analysis only counts levels drawn on an earlier candle. */
  at?: number;
}

export type Drawing =
  | (Base & {
      kind: 'hline';
      a: Pt;
      /** Price alert: pauses auto-play when price touches the line (from candle `alertFrom` on). */
      alert?: boolean;
      alertFrom?: number;
      fired?: boolean;
    })
  | (Base & { kind: 'trend' | 'ray' | 'rect' | 'fib'; a: Pt; b: Pt })
  | (Base & { kind: 'text'; a: Pt; text: string });

/** Tools that need two points. */
export const TWO_POINT: readonly DrawKind[] = ['trend', 'ray', 'rect', 'fib'];

export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] as const;

/** Fibonacci retracement prices from a (0) to b (1), e.g. a = swing low, b = swing high → levels measured back from b. */
export function fibPrices(a: number, b: number): { level: number; price: number }[] {
  return FIB_LEVELS.map((level) => ({ level, price: b - (b - a) * level }));
}

/**
 * Magnet: snap to the nearest open/high/low/close of the candle under the
 * cursor when within `thresholdPx`. `toY` converts a price to a pixel y.
 */
export function snapPrice(c: Candle | undefined, price: number, toY: (p: number) => number | null, thresholdPx = 14): number {
  if (!c) return price;
  const y = toY(price);
  if (y == null) return price;
  let best = price;
  let bestD = thresholdPx;
  for (const v of [c.open, c.high, c.low, c.close]) {
    const vy = toY(v);
    if (vy == null) continue;
    const d = Math.abs(vy - y);
    if (d <= bestD) { bestD = d; best = v; }
  }
  return best;
}

export interface XY { x: number; y: number }

/** Shortest distance from point p to segment ab (pixels). */
export function distToSegment(p: XY, a: XY, b: XY): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Extend a→b to the right edge `maxX` (for rays). */
export function rayEnd(a: XY, b: XY, maxX: number): XY {
  if (b.x === a.x) return { x: b.x, y: b.y > a.y ? 1e6 : -1e6 };
  const dir = b.x > a.x ? 1 : -1;
  const x = dir > 0 ? maxX : 0;
  return { x, y: a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x) };
}

export interface Projector {
  toXY: (pt: Pt) => XY | null;
  width: number;
}

/** The top-most drawing within `tol` px of p, if any. */
export function hitTest(drawings: Drawing[], p: XY, proj: Projector, tol = 10): string | null {
  for (let k = drawings.length - 1; k >= 0; k--) {
    const d = drawings[k];
    const a = proj.toXY(d.a);
    if (!a) continue;
    if (d.kind === 'hline') { if (Math.abs(p.y - a.y) <= tol) return d.id; continue; }
    if (d.kind === 'text') { if (Math.abs(p.x - a.x) <= 60 && Math.abs(p.y - a.y) <= 14) return d.id; continue; }
    const b = proj.toXY(d.b);
    if (!b) continue;
    if (d.kind === 'trend' && distToSegment(p, a, b) <= tol) return d.id;
    if (d.kind === 'ray' && distToSegment(p, a, rayEnd(a, b, proj.width)) <= tol) return d.id;
    if (d.kind === 'rect' || d.kind === 'fib') {
      const [x0, x1] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
      const [y0, y1] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
      if (p.x >= x0 - tol && p.x <= x1 + tol && p.y >= y0 - tol && p.y <= y1 + tol) return d.id;
    }
  }
  return null;
}

/** Horizontal lines whose alert fires on this candle. */
export function alertsHit(drawings: Drawing[], c: { high: number; low: number }, candleIndex: number): Drawing[] {
  return drawings.filter(
    (d) => d.kind === 'hline' && d.alert && !d.fired && candleIndex >= (d.alertFrom ?? 0) && c.low <= d.a.p && d.a.p <= c.high,
  );
}

/**
 * Support/resistance prices the player drew before candle `index`:
 * horizontal lines, zone edges, Fibonacci levels, and trend lines / rays at that candle.
 */
export function levelsAt(drawings: Drawing[], index: number): number[] {
  const out: number[] = [];
  for (const d of drawings) {
    if (d.at !== undefined && d.at >= index) continue; // drawn on this very candle: not prior analysis
    switch (d.kind) {
      case 'hline': out.push(d.a.p); break;
      case 'rect': out.push(d.a.p, d.b.p); break;
      case 'fib': out.push(...fibPrices(d.a.p, d.b.p).map((f) => f.price)); break;
      case 'trend':
      case 'ray': {
        const [l, r] = d.a.i <= d.b.i ? [d.a, d.b] : [d.b, d.a];
        if (l.i === r.i) break;
        const inRange = d.kind === 'trend' ? index >= l.i && index <= r.i : (d.b.i >= d.a.i ? index >= d.a.i : index <= d.a.i);
        if (inRange) out.push(l.p + ((r.p - l.p) * (index - l.i)) / (r.i - l.i));
        break;
      }
    }
  }
  return out;
}

/**
 * A trade "based on analysis": entry within one ATR of a level you drew
 * earlier, with the stop placed beyond that level (below support for a long,
 * above resistance for a short).
 */
export function isAnalysisTrade(
  levels: number[], side: 'long' | 'short', entry: number, stop: number | null, atr: number,
): boolean {
  if (stop === null) return false;
  return levels.some((l) => Math.abs(entry - l) <= atr && (side === 'long' ? stop < l : stop > l));
}

let seq = 0;
export const newDrawingId = () => `d${Date.now().toString(36)}${(seq++).toString(36)}`;
