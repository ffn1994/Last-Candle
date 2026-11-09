/**
 * Player-designed markets (pure). The trend is a path of 200 price
 * multipliers (1 = the starting price), drawn with a finger. It becomes a
 * normal scenario: segments of 10 candles whose closes land exactly on the
 * path, with realistic noise in between.
 */
import type { Scenario, Segment } from '../data/scenarios';

export const LEN = 200;
export const CHUNK = 10; // candles per segment: the drawing is followed every 10 candles
export const MIN_MULT = 1 / 3;
export const MAX_MULT = 3;
export const CUSTOM_ID_BASE = 1000;

export type Volatility = 'calm' | 'normal' | 'wild';
export const VOL: Record<Volatility, number> = { calm: 0.008, normal: 0.016, wild: 0.032 };

export interface CustomMarket {
  id: number; // ≥ CUSTOM_ID_BASE
  name: string;
  path: number[]; // LEN multipliers
  vol: Volatility;
  createdAt: number;
}

const clampMult = (v: number) => Math.max(MIN_MULT, Math.min(MAX_MULT, v));

export const flatPath = () => new Array<number>(LEN).fill(1);

/** Build a path through [index, multiplier] waypoints, interpolating in log space. */
export function fromWaypoints(points: [number, number][]): number[] {
  const out = new Array<number>(LEN);
  for (let k = 0; k + 1 < points.length; k++) {
    const [i0, v0] = points[k];
    const [i1, v1] = points[k + 1];
    for (let i = i0; i <= i1 && i < LEN; i++) {
      const t = i1 === i0 ? 0 : (i - i0) / (i1 - i0);
      out[i] = Math.exp(Math.log(v0) + (Math.log(v1) - Math.log(v0)) * t);
    }
  }
  return out.map((v) => clampMult(v ?? 1));
}

export const TEMPLATES = {
  rise: () => fromWaypoints([[0, 1], [199, 1.8]]),
  fall: () => fromWaypoints([[0, 1], [199, 0.55]]),
  bubble: () => fromWaypoints([[0, 1], [80, 1.4], [130, 2.6], [150, 2.2], [199, 1.1]]),
  crashRecovery: () => fromWaypoints([[0, 1], [90, 1.15], [115, 0.7], [199, 1.25]]),
  sideways: () => fromWaypoints([[0, 1], [40, 1.08], [80, 0.94], [120, 1.07], [160, 0.95], [199, 1.02]]),
} as const;
export type TemplateId = keyof typeof TEMPLATES;

/**
 * Apply one finger movement from (i0, v0) to (i1, v1): every candle index it
 * crosses takes the interpolated value, so redrawing over a part replaces it.
 */
export function applyStroke(path: number[], i0: number, v0: number, i1: number, v1: number): number[] {
  const out = path.slice();
  const a = Math.max(0, Math.min(LEN - 1, Math.round(i0)));
  const b = Math.max(0, Math.min(LEN - 1, Math.round(i1)));
  const [from, to, fv, tv] = a <= b ? [a, b, v0, v1] : [b, a, v1, v0];
  for (let i = from; i <= to; i++) {
    const t = to === from ? 1 : (i - from) / (to - from);
    out[i] = clampMult(Math.exp(Math.log(fv) + (Math.log(tv) - Math.log(fv)) * t));
  }
  return out;
}

/** Moving average in log space to remove finger jitter (ends are kept). */
export function smooth(path: number[], w = 2): number[] {
  const logs = path.map(Math.log);
  return path.map((v, i) => {
    if (i < w || i >= path.length - w) return v;
    let s = 0;
    for (let j = i - w; j <= i + w; j++) s += logs[j];
    return Math.exp(s / (2 * w + 1));
  });
}

/** Segments that make the generated closes hit the path every CHUNK candles. */
export function toSegments(path: number[], vol: Volatility): Segment[] {
  const segs: Segment[] = [];
  for (let k = 0; k < LEN; k += CHUNK) {
    const from = k === 0 ? path[0] : path[k - 1];
    const to = path[Math.min(LEN - 1, k + CHUNK - 1)];
    segs.push({ len: Math.min(CHUNK, LEN - k), mult: to / from, vol: VOL[vol] });
  }
  return segs;
}

export const START_PRICE = 100;

export function toScenario(m: CustomMarket): Scenario {
  return {
    id: m.id,
    name: m.name,
    // the first segment starts from here, so candle 9 closes on path[9]
    start: START_PRICE * m.path[0],
    segments: toSegments(m.path, m.vol),
    news: [],
  };
}

export const isCustomId = (id: number) => id >= CUSTOM_ID_BASE;

export function nextCustomId(existing: CustomMarket[]): number {
  return Math.max(CUSTOM_ID_BASE - 1, ...existing.map((m) => m.id)) + 1;
}
