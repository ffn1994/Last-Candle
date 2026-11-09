import type { NerveEvent, NerveReason, RoundState } from './types';

export const NERVES = {
  start: 100,
  noStop: -15,
  widenStop: -10,
  revenge: -10,
  lossStreak: -5, // per consecutive loss after the 2nd
  byPlan: 5,
  patience: 2,
  analysis: 3,
  patienceEvery: 10,
  revengeWindow: 3,
  lowThreshold: 30,
} as const;

export const clampNerves = (n: number) => Math.max(0, Math.min(100, n));

export function addNerves(s: RoundState, delta: number, reason: NerveReason): RoundState {
  const ev: NerveEvent = { at: s.index, delta, reason };
  return { ...s, nerves: clampNerves(s.nerves + delta), nervesLog: [...s.nervesLog, ev] };
}

export const isRevenge = (s: RoundState) =>
  s.lastLossAt !== null && s.index - s.lastLossAt <= NERVES.revengeWindow;

/** A stop moved "further away" means more risk: lower for longs, higher for shorts. */
export function isWidening(side: 'long' | 'short', oldStop: number, newStop: number): boolean {
  return side === 'long' ? newStop < oldStop : newStop > oldStop;
}

export const isLowNerves = (n: number) => n < NERVES.lowThreshold;
