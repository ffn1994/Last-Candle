/**
 * Scenario generators. Each scenario is a list of regime segments modeled on a
 * real market event. Output is deterministic for a given seed, so a saved round
 * can be rebuilt from (scenarioId, seed). Swap `generateCandles` for real data later.
 */
import { gaussian, hashString, mulberry32 } from '../game/rng';
import { TOTAL_CANDLES } from '../game/engine';
import type { Candle } from '../game/types';

export interface Segment {
  len: number; // candles
  mult: number; // close-to-close multiplier across the segment
  vol: number; // daily volatility (stdev of log return)
  gap?: number; // extra opening-gap volatility
}

export interface NewsEvent {
  at: number; // candle index at which the card pops up
  text: string;
  impact?: { delay: number; move: number }; // real catalyst: price jumps `move` after `delay` candles
}

export interface Scenario {
  id: number;
  name: string; // revealed at the end only
  start: number;
  segments: Segment[];
  /**
   * Generator v2: the same story with its signature classical pattern built in.
   * Segment multipliers compensate for the news shocks applied afterwards, so
   * the two tops / bottoms really end up level.
   */
  segmentsV2?: Segment[];
  news: NewsEvent[];
}

export const SCENARIOS: Scenario[] = [
  {
    id: 1,
    name: 'فقاعة الدوت كوم 2000',
    start: 120,
    segments: [
      { len: 60, mult: 1.3, vol: 0.012 },
      { len: 60, mult: 1.45, vol: 0.014 },
      { len: 20, mult: 1.35, vol: 0.03 },
      { len: 60, mult: 0.42, vol: 0.028, gap: 0.01 },
    ],
    segmentsV2: [
      { len: 60, mult: 1.3, vol: 0.012 },
      { len: 25, mult: 1.2, vol: 0.013 },
      { len: 10, mult: 0.96, vol: 0.008 }, // bull flag
      { len: 25, mult: 1.24, vol: 0.013 },
      { len: 20, mult: 1.3, vol: 0.022 }, // euphoric spike → first top
      { len: 8, mult: 0.93, vol: 0.011 }, // dip (the −8% news at 144 deepens it)
      { len: 8, mult: 1 / (0.93 * 0.92), vol: 0.011 }, // rally back to the top → double top
      { len: 6, mult: 0.92, vol: 0.01 }, // calm roll-over from the second top
      { len: 38, mult: 0.46 / 0.92, vol: 0.026, gap: 0.01 }, // breakdown and slow collapse
    ],
    news: [
      { at: 92, text: 'البنك المركزي يرفع الفائدة', impact: { delay: 2, move: -0.04 } },
      { at: 125, text: 'أسهم التقنية تسجل أرقام قياسية والكل يشتري' },
      { at: 143, text: 'شركة تقنية كبرى تعلن خسائر غير متوقعة', impact: { delay: 1, move: -0.08 } },
      { at: 172, text: 'محللون: التصحيح انتهى والسوق بيرجع يرتفع' },
    ],
  },
  {
    id: 2,
    name: 'أزمة 2008',
    start: 85,
    segments: [
      { len: 60, mult: 1.03, vol: 0.012 },
      { len: 50, mult: 0.85, vol: 0.016 },
      { len: 40, mult: 0.55, vol: 0.04, gap: 0.015 },
      { len: 50, mult: 1.15, vol: 0.03 },
    ],
    segmentsV2: [
      { len: 60, mult: 1.04, vol: 0.011 },
      { len: 8, mult: 1.05, vol: 0.009 }, // left shoulder
      { len: 7, mult: 0.95, vol: 0.009 },
      { len: 9, mult: 1.09, vol: 0.009 }, // head
      { len: 9, mult: 0.91, vol: 0.009 },
      { len: 7, mult: 1.045, vol: 0.009 }, // right shoulder
      { len: 10, mult: 0.95, vol: 0.011 }, // neckline break (bank failure news at 108)
      { len: 20, mult: 0.88, vol: 0.02 },
      { len: 30, mult: 0.62, vol: 0.04, gap: 0.015 },
      { len: 20, mult: 1.12, vol: 0.028 }, // weak bounce
      { len: 20, mult: 0.96, vol: 0.026 },
    ],
    news: [
      { at: 75, text: 'تقارير عن مشاكل في سوق العقار' },
      { at: 108, text: 'بنك استثماري كبير يعلن إفلاسه', impact: { delay: 1, move: -0.09 } },
      { at: 128, text: 'شائعات عن اندماج بنوك كبرى' },
      { at: 152, text: 'الحكومة تعلن خطة إنقاذ ضخمة', impact: { delay: 2, move: 0.06 } },
    ],
  },
  {
    id: 3,
    name: 'جائحة 2020',
    start: 300,
    segments: [
      { len: 60, mult: 1.12, vol: 0.009 },
      { len: 40, mult: 1.08, vol: 0.009 },
      { len: 25, mult: 0.65, vol: 0.045, gap: 0.02 },
      { len: 75, mult: 1.55, vol: 0.022 },
    ],
    segmentsV2: [
      { len: 60, mult: 1.12, vol: 0.009 },
      { len: 40, mult: 1.08, vol: 0.009 },
      { len: 17, mult: 0.68, vol: 0.04, gap: 0.02 }, // crash
      { len: 4, mult: 0.65 / 0.68, vol: 0.01 }, // capitulation → first bottom on 120
      { len: 6, mult: 1.09 / 1.07, vol: 0.008 }, // the rate cut (+7% at 121) starts the bounce
      { len: 6, mult: 1 / 1.09, vol: 0.008 }, // retest → double bottom
      { len: 8, mult: 1.1, vol: 0.01 }, // neckline break
      { len: 59, mult: 1.38, vol: 0.019 },
    ],
    news: [
      { at: 97, text: 'فيروس جديد ينتشر في عدة دول', impact: { delay: 3, move: -0.05 } },
      { at: 120, text: 'البنك المركزي يخفض الفائدة إلى الصفر', impact: { delay: 1, move: 0.07 } },
      { at: 145, text: 'مخاوف من موجة ثانية' },
    ],
  },
  {
    id: 4,
    name: 'جنون الكريبتو 2021',
    start: 30,
    segments: [
      { len: 60, mult: 1.6, vol: 0.035 },
      { len: 50, mult: 2.2, vol: 0.045 },
      { len: 15, mult: 1.3, vol: 0.06 },
      { len: 75, mult: 0.3, vol: 0.05, gap: 0.01 },
    ],
    segmentsV2: [
      { len: 60, mult: 1.6, vol: 0.032 },
      { len: 45, mult: 1.85, vol: 0.038 },
      { len: 10, mult: 1.2, vol: 0.03 }, // first top (candle 114)
      { len: 6, mult: 0.8, vol: 0.016 },
      { len: 8, mult: 1.25, vol: 0.016 }, // back to the top on 128 → double top
      { len: 71, mult: 0.32, vol: 0.045, gap: 0.01 }, // the mining ban (129) breaks it
    ],
    news: [
      { at: 100, text: 'شركة كبرى تعلن شراء عملات رقمية', impact: { delay: 1, move: 0.1 } },
      { at: 128, text: 'دولة كبرى تحظر التعدين', impact: { delay: 1, move: -0.15 } },
      { at: 160, text: 'مشاهير يروّجون لعملة جديدة' },
    ],
  },
  {
    id: 5,
    name: 'السوق الممل',
    start: 50,
    segments: [
      { len: 30, mult: 1.04, vol: 0.008 },
      { len: 30, mult: 0.96, vol: 0.008 },
      { len: 25, mult: 1.03, vol: 0.008 },
      { len: 30, mult: 0.97, vol: 0.008 },
      { len: 25, mult: 1.03, vol: 0.008 },
      { len: 30, mult: 0.97, vol: 0.008 },
      { len: 30, mult: 1.02, vol: 0.008 },
    ],
    news: [
      { at: 90, text: 'البنك المركزي يرفع الفائدة' },
      { at: 130, text: 'أرباح الشركات أفضل من المتوقع' },
      { at: 170, text: 'خبير مشهور يتوقع انهيار وشيك' },
    ],
  },
];

// Player-designed markets, registered at startup and when saved.
const customs = new Map<number, Scenario>();
export const registerCustomScenario = (sc: Scenario) => { customs.set(sc.id, sc); };
export const unregisterCustomScenario = (id: number) => { customs.delete(id); };

export const getScenario = (id: number) => SCENARIOS.find((s) => s.id === id) ?? customs.get(id) ?? SCENARIOS[0];

const DAY = 86_400;

/** Generator version used for new rounds; saved rounds keep the one they started with. */
export const CURRENT_GEN = 2;

export function generateCandles(sc: Scenario, seed: number, gen = 1): Candle[] {
  const rng = mulberry32(seed);
  const segments = gen >= 2 && sc.segmentsV2 ? sc.segmentsV2 : sc.segments;
  const closes: number[] = [];
  const segOf: Segment[] = [];
  let p = sc.start;

  // Each segment is a random walk "bridged" so it ends exactly at start × mult,
  // keeping the shape of the real event while noise differs per seed.
  for (const seg of segments) {
    const incs = Array.from({ length: seg.len }, () => gaussian(rng) * seg.vol);
    const mean = incs.reduce((a, b) => a + b, 0) / seg.len;
    const drift = Math.log(seg.mult) / seg.len;
    for (const inc of incs) {
      p *= Math.exp(inc - mean + drift);
      closes.push(p);
      segOf.push(seg);
    }
  }

  const jumpAt = new Map<number, number>();
  for (const n of sc.news) {
    if (!n.impact) continue;
    const idx = n.at + n.impact.delay;
    jumpAt.set(idx, n.impact.move);
    for (let i = idx; i < closes.length; i++) closes[i] *= 1 + n.impact.move;
  }

  // Volume uses its own RNG stream so adding it never changes prices for a seed.
  const vrng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const baseVol = 1_000_000 * (0.5 + vrng());

  const candles: Candle[] = [];
  for (let i = 0; i < Math.min(closes.length, TOTAL_CANDLES); i++) {
    const seg = segOf[i];
    const prev = i === 0 ? sc.start : closes[i - 1];
    const jump = jumpAt.get(i);
    const open = jump !== undefined
      ? prev * (1 + jump * 0.6)
      : prev * (1 + gaussian(rng) * (seg.vol * 0.25 + (seg.gap ?? 0)));
    const close = closes[i];
    const high = Math.max(open, close) * (1 + Math.abs(gaussian(rng)) * seg.vol * 0.6);
    const low = Math.min(open, close) * (1 - Math.abs(gaussian(rng)) * seg.vol * 0.6);
    // Volume rises with the size of the move, with volatility regimes and on news shocks.
    const move = Math.abs(Math.log(close / prev)) / seg.vol;
    const volume = baseVol * (0.6 + 0.5 * move + seg.vol * 20) * (jump !== undefined ? 3 : 1)
      * Math.exp(gaussian(vrng) * 0.25);
    candles.push({ time: (i + 1) * DAY, open, high, low, close, volume });
  }
  return candles;
}

export const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Daily challenge: seed = today's date, scenario picked from that seed. */
export function dailyChallenge(d = new Date()): { scenarioId: number; seed: number; key: string } {
  const key = todayKey(d);
  const seed = hashString(key);
  return { key, seed, scenarioId: SCENARIOS[seed % SCENARIOS.length].id };
}

export const newsAt = (scenarioId: number, index: number) =>
  getScenario(scenarioId).news.find((n) => n.at === index) ?? null;
