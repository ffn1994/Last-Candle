import { ar } from '../i18n/ar';
import { isLowNerves } from './nerves';
import type { RoundStats } from './scoring';

/** Pick the 3 most relevant lessons, mistakes first, then strengths. */
export function lessonsFor(s: RoundStats, reckless: number): string[] {
  const L = ar.lessons;
  const mistakes: string[] = [];
  if (reckless > 0) mistakes.push(L.noStop(reckless));
  if (s.revengeTrades > 0) mistakes.push(L.revenge(s.revengeTrades));
  if (s.stopWidenings > 0) mistakes.push(L.widen(s.stopWidenings));
  if (s.avgRiskPct > 2.05) mistakes.push(L.highRisk(s.avgRiskPct.toFixed(1)));
  if (s.trades > 25) mistakes.push(L.overtrading(s.trades));
  if (s.maxDrawdownPct > 25) mistakes.push(L.deepDrawdown(s.maxDrawdownPct.toFixed(0)));
  if (isLowNerves(s.finalNerves)) mistakes.push(L.lowNerves);
  if (s.trades === 0) mistakes.push(L.noTrades);

  const good: string[] = [];
  if (s.trades > 0 && reckless === 0) good.push(L.goodStops);
  if (s.trades > 0 && s.winRate < 50 && s.avgRiskPct <= 2.05 && s.maxDrawdownPct < 25) good.push(L.lowWinGoodRisk);
  if (s.trades > 0 && s.trades <= 15) good.push(L.goodPatience);
  if (s.finalNerves >= 70) good.push(L.goodNerves);

  return [...mistakes, ...good].slice(0, 3);
}
