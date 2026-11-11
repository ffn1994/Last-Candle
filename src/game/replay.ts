/** Pure helpers for replaying a finished round. */
import { NERVES, clampNerves } from './nerves';
import type { ClosedTrade, NerveEvent } from './types';

/** Nerves level at the close of every candle from `from` to `to`, rebuilt from the event log. */
export function nervesTimeline(log: NerveEvent[], from: number, to: number): { i: number; v: number }[] {
  const out: { i: number; v: number }[] = [];
  let v: number = NERVES.start;
  let k = 0;
  const sorted = [...log].sort((a, b) => a.at - b.at);
  for (let i = from; i <= to; i++) {
    while (k < sorted.length && sorted[k].at <= i) v = clampNerves(v + sorted[k++].delta);
    out.push({ i, v });
  }
  return out;
}

export type MarkKind = 'entry' | 'exit' | 'widen';

export interface ReplayMark {
  i: number; // candle index
  kind: MarkKind;
  side?: 'long' | 'short';
  trade?: number; // index into trades
  good?: boolean; // exits: profit
  tags: string[]; // mistake / quality tags shown with the marker
}

/** Markers for every entry, exit and stop widening, sorted by candle. */
export function replayMarks(trades: ClosedTrade[], log: NerveEvent[]): ReplayMark[] {
  const marks: ReplayMark[] = [];
  trades.forEach((t, n) => {
    const tags: string[] = [];
    if (t.reckless) tags.push('reckless');
    if (t.revenge) tags.push('revenge');
    if (t.analysis) tags.push('analysis');
    marks.push({ i: t.openedAt, kind: 'entry', side: t.side, trade: n, tags });
    marks.push({ i: t.closedAt, kind: 'exit', side: t.side, trade: n, good: t.pnl >= 0, tags: [t.reason] });
  });
  for (const e of log) if (e.reason === 'widenStop') marks.push({ i: e.at, kind: 'widen', tags: [] });
  return marks.sort((a, b) => a.i - b.i);
}
