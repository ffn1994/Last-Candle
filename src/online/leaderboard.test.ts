import { describe, expect, it } from 'vitest';
import { dailyDayOf } from './leaderboard';
import { dailyChallenge } from '../data/scenarios';
import { newRound } from '../game/engine';

describe('daily round → its date', () => {
  it('finds the date a daily round was dealt from, even just after midnight', () => {
    const d = new Date(2026, 10, 12, 23, 59);
    const c = dailyChallenge(d);
    const r = { ...newRound({ scenarioId: c.scenarioId, mode: 'normal', seed: c.seed, daily: true }), startedAt: d.getTime() + 2 * 60_000 };
    expect(dailyDayOf(r)).toBe('2026-11-12');
  });
  it('returns null for a non-daily seed', () => {
    expect(dailyDayOf({ ...newRound({ scenarioId: 1, mode: 'normal', seed: 123, daily: false }), startedAt: Date.now() })).toBeNull();
  });
});
