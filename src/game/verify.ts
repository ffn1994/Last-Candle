/**
 * Replaying a round from its action log. The server uses exactly this code
 * (bundled into the edge function) to recompute a daily-challenge result, so
 * the leaderboard never trusts a score sent by a phone.
 */
import { applyCandle, atr, closeTrade, moveStop, newRound, openTrade, HISTORY_CANDLES, TOTAL_CANDLES } from './engine';
import { computeStats, type RoundStats } from './scoring';
import type { Action, Candle, Mode, RoundState } from './types';

export interface ReplayInput { scenarioId: number; seed: number; gen: number; mode: Mode; daily: boolean }

/**
 * Rebuild the round: on every candle apply that candle's actions in order,
 * then advance. `trustAnalysis` false ignores the client's "analysis" flag
 * (it depends on drawings the server can't see).
 */
export function replayActions(input: ReplayInput, candles: Candle[], actions: Action[], trustAnalysis = true): RoundState {
  let s = newRound(input);
  let k = 0;
  while (s.status === 'playing') {
    while (k < actions.length && actions[k].at === s.index) {
      const a = actions[k++];
      const price = candles[s.index].close;
      if (a.t === 'open') {
        s = openTrade(s, { side: a.side, riskPct: a.riskPct, stop: a.stop, tp: a.tp, analysis: trustAnalysis && !!a.analysis }, price, atr(candles, s.index));
      } else if (a.t === 'close') {
        s = closeTrade(s, price, 'manual');
      } else {
        s = moveStop(s, a.price, price);
      }
    }
    if (s.index >= TOTAL_CANDLES - 1) break;
    s = applyCandle(s, candles[s.index + 1]);
  }
  return s;
}

export type VerifyError = 'badMode' | 'badActions' | 'unfinished';

export interface Verified { stats: RoundStats; survived: boolean }

/** Sanity checks, replay, and the verified result. */
export function verifyRound(input: ReplayInput, candles: Candle[], actions: unknown): Verified | VerifyError {
  if (input.mode !== 'normal' && input.mode !== 'sharia') return 'badMode';
  if (!Array.isArray(actions) || actions.length > 600) return 'badActions';
  let last = HISTORY_CANDLES - 1;
  for (const a of actions as Action[]) {
    if (!a || typeof a !== 'object' || !Number.isInteger(a.at) || a.at < last || a.at >= TOTAL_CANDLES) return 'badActions';
    last = a.at;
    if (a.t === 'open') {
      if ((a.side !== 'long' && a.side !== 'short') || ![0.5, 1, 2, 5].includes(a.riskPct)) return 'badActions';
      if ((a.stop !== null && !Number.isFinite(a.stop)) || (a.tp !== null && !Number.isFinite(a.tp))) return 'badActions';
    } else if (a.t === 'stop') {
      if (!Number.isFinite(a.price)) return 'badActions';
    } else if (a.t !== 'close') return 'badActions';
  }
  const s = replayActions(input, candles, actions as Action[], false);
  if (s.status === 'playing') return 'unfinished';
  return { stats: computeStats(s), survived: s.status === 'survived' };
}
