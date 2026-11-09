import { NERVES, addNerves, isRevenge, isWidening } from './nerves';
import type {
  Candle, CloseReason, ClosedTrade, Mode, OpenParams, Position, RoundState,
} from './types';

export const START_EQUITY = 10_000;
export const LIQUIDATION_EQUITY = 5_000;
export const TOTAL_CANDLES = 200;
export const HISTORY_CANDLES = 60;
export const MAX_LEVERAGE: Record<Mode, number> = { normal: 5, sharia: 1 };

export function newRound(p: { scenarioId: number; mode: Mode; seed: number; daily: boolean }): RoundState {
  return {
    ...p,
    index: HISTORY_CANDLES - 1,
    cash: START_EQUITY,
    position: null,
    trades: [],
    nerves: NERVES.start,
    nervesLog: [],
    lastLossAt: null,
    consecutiveLosses: 0,
    idleCandles: 0,
    peakEquity: START_EQUITY,
    maxDrawdown: 0,
    stopWidenings: 0,
    status: 'playing',
    newsSeen: [],
    startedAt: Date.now(),
  };
}

export const pnlAt = (pos: Position, price: number) =>
  (pos.side === 'long' ? price - pos.entry : pos.entry - price) * pos.size;

export const equityAt = (s: RoundState, price: number) =>
  s.cash + (s.position ? pnlAt(s.position, price) : 0);

/** Average True Range over the last `period` candles up to and including `index`. */
export function atr(candles: Candle[], index: number, period = 14): number {
  const from = Math.max(1, index - period + 1);
  let sum = 0;
  let n = 0;
  for (let i = from; i <= index; i++) {
    const c = candles[i];
    const pc = candles[i - 1].close;
    sum += Math.max(c.high - c.low, Math.abs(c.high - pc), Math.abs(c.low - pc));
    n++;
  }
  return n ? sum / n : candles[index].high - candles[index].low;
}

export const defaultStop = (side: 'long' | 'short', price: number, atrValue: number) =>
  side === 'long' ? price - 2 * atrValue : price + 2 * atrValue;

/**
 * Units to buy so that hitting the stop loses `riskPct` of equity,
 * capped by the mode's max leverage.
 */
export function positionSize(
  equity: number, riskPct: number, entry: number, stopDistance: number, mode: Mode,
): number {
  if (stopDistance <= 0 || entry <= 0) return 0;
  const bySize = (equity * riskPct) / 100 / stopDistance;
  const byLeverage = (equity * MAX_LEVERAGE[mode]) / entry;
  return Math.min(bySize, byLeverage);
}

export type OpenError = 'hasPosition' | 'shortNotAllowed' | 'badStop' | 'badTp' | 'notPlaying';

export function validateOpen(s: RoundState, p: OpenParams, price: number): OpenError | null {
  if (s.status !== 'playing') return 'notPlaying';
  if (s.position) return 'hasPosition';
  if (s.mode === 'sharia' && p.side === 'short') return 'shortNotAllowed';
  if (p.stop !== null && (p.side === 'long' ? p.stop >= price : p.stop <= price)) return 'badStop';
  if (p.tp !== null && (p.side === 'long' ? p.tp <= price : p.tp >= price)) return 'badTp';
  return null;
}

/** Open at the current candle's close. `atrValue` sizes trades that have no stop. */
export function openTrade(s: RoundState, p: OpenParams, price: number, atrValue: number): RoundState {
  if (validateOpen(s, p, price)) return s;
  const equity = s.cash;
  const dist = p.stop !== null ? Math.abs(price - p.stop) : 2 * atrValue;
  const size = positionSize(equity, p.riskPct, price, dist, s.mode);
  const revenge = isRevenge(s);
  const position: Position = {
    side: p.side, size, entry: price, stop: p.stop, tp: p.tp, openedAt: s.index,
    riskPct: (size * dist * 100) / equity,
    reckless: p.stop === null,
    revenge,
    analysis: !!p.analysis && p.stop !== null,
    pe: p.pe ?? null,
    eventSoon: !!p.eventSoon,
  };
  let next: RoundState = { ...s, position, idleCandles: 0 };
  if (position.reckless) next = addNerves(next, NERVES.noStop, 'noStop');
  if (revenge) next = addNerves(next, NERVES.revenge, 'revenge');
  if (position.analysis) next = addNerves(next, NERVES.analysis, 'analysis');
  return next;
}

export function closeTrade(s: RoundState, exit: number, reason: CloseReason): RoundState {
  const pos = s.position;
  if (!pos) return s;
  const pnl = pnlAt(pos, exit);
  const trade: ClosedTrade = {
    side: pos.side, size: pos.size, entry: pos.entry, exit, pnl,
    openedAt: pos.openedAt, closedAt: s.index, reason,
    riskPct: pos.riskPct, reckless: pos.reckless, revenge: pos.revenge, analysis: pos.analysis,
    pe: pos.pe, eventSoon: pos.eventSoon,
  };
  let next: RoundState = { ...s, position: null, cash: s.cash + pnl, trades: [...s.trades, trade] };
  if (pnl < 0) {
    const streak = s.consecutiveLosses + 1;
    next = { ...next, consecutiveLosses: streak, lastLossAt: s.index };
    if (streak > 2) next = addNerves(next, NERVES.lossStreak, 'lossStreak');
  } else {
    next = { ...next, consecutiveLosses: 0 };
  }
  if (reason === 'stop' || reason === 'tp') next = addNerves(next, NERVES.byPlan, 'byPlan');
  return next;
}

/** Move (or add) the stop. Moving it further from entry costs nerves. */
export function moveStop(s: RoundState, newStop: number, price: number): RoundState {
  const pos = s.position;
  if (!pos) return s;
  if (pos.side === 'long' ? newStop >= price : newStop <= price) return s;
  let next: RoundState = { ...s, position: { ...pos, stop: newStop } };
  if (pos.stop !== null && isWidening(pos.side, pos.stop, newStop)) {
    next = addNerves({ ...next, stopWidenings: s.stopWidenings + 1 }, NERVES.widenStop, 'widenStop');
  }
  return next;
}

/**
 * Where the stop/TP fills on this candle, if at all.
 * A gap through a level fills at the open (the open is unambiguously first).
 * Otherwise, if both are touched inside the same candle, the stop wins (conservative).
 */
export function triggerFor(pos: Position, c: Candle): { price: number; reason: 'stop' | 'tp' } | null {
  const long = pos.side === 'long';
  const beyond = (p: number, level: number, side: 'stop' | 'tp') =>
    (long ? side === 'stop' : side === 'tp') ? p <= level : p >= level;

  if (pos.stop !== null && beyond(c.open, pos.stop, 'stop')) return { price: c.open, reason: 'stop' };
  if (pos.tp !== null && beyond(c.open, pos.tp, 'tp')) return { price: c.open, reason: 'tp' };
  if (pos.stop !== null && beyond(long ? c.low : c.high, pos.stop, 'stop')) return { price: pos.stop, reason: 'stop' };
  if (pos.tp !== null && beyond(long ? c.high : c.low, pos.tp, 'tp')) return { price: pos.tp, reason: 'tp' };
  return null;
}

/** Advance one candle: fills, patience, drawdown, liquidation, end of round. */
export function applyCandle(s: RoundState, c: Candle): RoundState {
  if (s.status !== 'playing') return s;
  let next: RoundState = { ...s, index: s.index + 1 };

  if (next.position) {
    const hit = triggerFor(next.position, c);
    if (hit) next = closeTrade(next, hit.price, hit.reason);
  }

  if (!next.position) {
    const idle = next.idleCandles + 1;
    next = { ...next, idleCandles: idle };
    if (idle >= NERVES.patienceEvery) {
      next = addNerves({ ...next, idleCandles: 0 }, NERVES.patience, 'patience');
    }
  }

  const eq = equityAt(next, c.close);
  const peak = Math.max(next.peakEquity, eq);
  next = { ...next, peakEquity: peak, maxDrawdown: Math.max(next.maxDrawdown, (peak - eq) / peak) };

  if (eq <= LIQUIDATION_EQUITY) {
    next = closeTrade(next, c.close, 'liquidation');
    return { ...next, status: 'liquidated' };
  }
  if (next.index >= TOTAL_CANDLES - 1) {
    next = closeTrade(next, c.close, 'end');
    return { ...next, status: 'survived' };
  }
  return next;
}
