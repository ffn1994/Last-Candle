import { START_EQUITY } from './engine';
import type { RoundState } from './types';

export type Grade = 'S' | 'A' | 'B' | 'C' | 'F';

export interface RoundStats {
  returnPct: number;
  maxDrawdownPct: number;
  winRate: number; // 0..100
  trades: number;
  stopsPct: number; // % of trades opened with a stop
  avgRiskPct: number;
  revengeTrades: number;
  stopWidenings: number;
  finalNerves: number;
  discipline: number; // 0..100
  score: number; // 0..100
  grade: Grade;
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

/**
 * Discipline (0–100):
 *  35 — share of trades with a stop
 *  25 — average risk (full at ≤2%, zero at ≥5%)
 *  20 — revenge trades (−7 each)
 *  20 — final nerves
 */
export function disciplineScore(s: Pick<RoundStats, 'stopsPct' | 'avgRiskPct' | 'revengeTrades' | 'finalNerves'>): number {
  const stops = (s.stopsPct / 100) * 35;
  const risk = s.avgRiskPct <= 2 ? 25 : clamp(25 * (1 - (s.avgRiskPct - 2) / 3), 0, 25);
  const revenge = clamp(20 - 7 * s.revengeTrades, 0, 20);
  const nerves = (s.finalNerves / 100) * 20;
  return Math.round(stops + risk + revenge + nerves);
}

/** −50% → 0, 0% → 50, +30% → 100. */
export const returnScore = (r: number) => clamp(r >= 0 ? 50 + (r / 30) * 50 : 50 + r);

/** 0% drawdown → 100, 50% → 0. */
export const drawdownScore = (ddPct: number) => clamp(100 - ddPct * 2);

export function gradeFor(score: number, liquidated: boolean): Grade {
  if (liquidated) return 'F';
  if (score >= 85) return 'S';
  if (score >= 70) return 'A';
  if (score >= 55) return 'B';
  if (score >= 40) return 'C';
  return 'F';
}

export function computeStats(s: RoundState): RoundStats {
  const t = s.trades;
  const n = t.length;
  const wins = t.filter((x) => x.pnl > 0).length;
  const withStop = t.filter((x) => !x.reckless).length;
  const avgRiskPct = n ? t.reduce((a, x) => a + x.riskPct, 0) / n : 0;
  const base = {
    returnPct: ((s.cash - START_EQUITY) / START_EQUITY) * 100,
    maxDrawdownPct: s.maxDrawdown * 100,
    winRate: n ? (wins / n) * 100 : 0,
    trades: n,
    stopsPct: n ? (withStop / n) * 100 : 100,
    avgRiskPct,
    revengeTrades: t.filter((x) => x.revenge).length,
    stopWidenings: s.stopWidenings,
    finalNerves: s.nerves,
  };
  const discipline = disciplineScore(base);
  const score = Math.round(
    0.6 * discipline + 0.25 * returnScore(base.returnPct) + 0.15 * drawdownScore(base.maxDrawdownPct),
  );
  return { ...base, discipline, score, grade: gradeFor(score, s.status === 'liquidated') };
}
