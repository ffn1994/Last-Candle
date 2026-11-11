import { describe, expect, it } from 'vitest';
import { isUnlocked, levelFrom, newlyUnlocked, nextLocked, requiredLevel } from './progression';

describe('progressive tools', () => {
  it('a new player has none; each survival opens the next', () => {
    expect(isUnlocked('chart', 0, false)).toBe(false);
    expect(isUnlocked('chart', 1, false)).toBe(true);
    expect(isUnlocked('drawing', 1, false)).toBe(false);
    expect(isUnlocked('fundamentals', 4, false)).toBe(true);
    expect(requiredLevel('classic')).toBe(3);
  });
  it('"unlock all" opens everything', () => {
    expect(isUnlocked('fundamentals', 0, true)).toBe(true);
  });
  it('level counts survived rounds only', () => {
    expect(levelFrom([{ survived: true }, { survived: false }, { survived: true }])).toBe(2);
  });
  it('reports what a survival just unlocked and what is next', () => {
    expect(newlyUnlocked(0, 1)).toEqual(['chart']);
    expect(newlyUnlocked(1, 1)).toEqual([]);
    expect(newlyUnlocked(4, 5)).toEqual([]);
    expect(nextLocked(2)).toEqual({ id: 'classic', level: 3 });
    expect(nextLocked(4)).toBeNull();
  });
});
