import { describe, expect, it } from 'vitest';
import { restoreScreen } from './store';
import { newRound } from './game/engine';

const round = newRound({ scenarioId: 1, mode: 'normal', seed: 1, daily: false });
const base = { round: null, lastResult: null, pending: null };

describe('restoreScreen after reload', () => {
  it('returns to the game when a round is saved', () => {
    expect(restoreScreen({ ...base, screen: 'game', round })).toBe('game');
  });
  it('falls back to the menu when the needed data is gone', () => {
    expect(restoreScreen({ ...base, screen: 'game' })).toBe('menu');
    expect(restoreScreen({ ...base, screen: 'end' })).toBe('menu');
    expect(restoreScreen({ ...base, screen: 'briefing' })).toBe('menu');
  });
  it('keeps other screens and never restores the splash', () => {
    expect(restoreScreen({ ...base, screen: 'history' })).toBe('history');
    expect(restoreScreen({ ...base, screen: 'splash' })).toBeUndefined();
    expect(restoreScreen({ ...base })).toBeUndefined();
  });
});
