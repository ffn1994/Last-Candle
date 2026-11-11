/**
 * Progressive tools: a new player starts with candles, buy/sell, stop and
 * nerves; every round survived unlocks the next tool. Experienced traders can
 * unlock everything at once.
 */
export type ToolId = 'chart' | 'drawing' | 'classic' | 'fundamentals';

/** In unlock order; `level` = rounds survived needed. */
export const TOOLS: { id: ToolId; level: number }[] = [
  { id: 'chart', level: 1 }, // indicators, weekly view, chart types
  { id: 'drawing', level: 2 }, // drawing tools and price alerts
  { id: 'classic', level: 3 }, // support/resistance and chart patterns
  { id: 'fundamentals', level: 4 }, // valuation, macro data, calendar
];

/** Progress = number of rounds survived. */
export const levelFrom = (history: { survived: boolean }[]) => history.filter((h) => h.survived).length;

export const isUnlocked = (tool: ToolId, level: number, unlockAll: boolean) =>
  unlockAll || level >= TOOLS.find((t) => t.id === tool)!.level;

export const requiredLevel = (tool: ToolId) => TOOLS.find((t) => t.id === tool)!.level;

/** Tools opened by going from `before` to `after` survived rounds. */
export const newlyUnlocked = (before: number, after: number): ToolId[] =>
  TOOLS.filter((t) => t.level > before && t.level <= after).map((t) => t.id);

/** The next tool still locked, if any. */
export const nextLocked = (level: number): { id: ToolId; level: number } | null =>
  TOOLS.find((t) => t.level > level) ?? null;
