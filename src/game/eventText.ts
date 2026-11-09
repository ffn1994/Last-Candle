import { ar } from '../i18n/ar';
import type { ScheduledEvent } from '../data/fundamentals';

export interface NewsItem { title: string; text: string }

const pct = (x: number) => (Math.abs(x) * 100).toFixed(0);

/** Card / notice text for a released scheduled event. */
export function describeEvent(e: ScheduledEvent): NewsItem {
  const E = ar.events;
  switch (e.kind) {
    case 'earnings': {
      const s = e.surprise ?? 0;
      const verdict = Math.abs(s) < 0.02 ? E.inline : s > 0 ? E.beat(pct(s)) : E.miss(pct(s));
      return { title: E.earnings, text: `${E.earningsText(e.actual.toFixed(2), (e.expected ?? e.actual).toFixed(2))}\n${verdict}` };
    }
    case 'rate': {
      const from = (e.previous ?? e.actual).toFixed(2);
      const to = e.actual.toFixed(2);
      const text = e.actual > (e.previous ?? e.actual) ? E.hike(from, to) : e.actual < (e.previous ?? e.actual) ? E.cut(from, to) : E.hold(to);
      return { title: E.rate, text };
    }
    case 'cpi':
      return { title: E.cpi, text: E.cpiText(e.actual.toFixed(1), (e.previous ?? e.actual).toFixed(1), e.actual >= (e.previous ?? e.actual)) };
  }
}
