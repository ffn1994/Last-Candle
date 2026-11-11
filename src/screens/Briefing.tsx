import { Button } from '../components/Button';
import { Header, Screen } from '../components/Screen';
import { ar } from '../i18n/ar';
import { useStore } from '../store';
import { START_EQUITY } from '../game/engine';
import { fmtMoney } from '../format';
import { isCustomId } from '../game/customMarket';
import { HISTORICAL, isHistoricalId } from '../data/historical';
import { getScenario } from '../data/scenarios';

export function Briefing() {
  const pending = useStore((s) => s.pending);
  const { startRound, go } = useStore.getState();
  if (!pending) return null;
  const title = pending.daily ? ar.mode.dailyTitle
    : isCustomId(pending.scenarioId) ? `🎨 ${getScenario(pending.scenarioId).name}`
    : isHistoricalId(pending.scenarioId) ? `📜 ${ar.hist.market(HISTORICAL.findIndex((s) => s.id === pending.scenarioId) + 1)}`
    : ar.mode.unknownMarket(pending.scenarioId);

  return (
    <Screen>
      <Header title={ar.briefing.title} onBack={() => go('mode')} />
      <div className="flex-1 overflow-y-auto px-4">
        <div className="mb-4 rounded-2xl border border-border bg-surface p-5 text-center">
          <div className="text-sm text-muted">{title} · {pending.mode === 'normal' ? ar.mode.normal : ar.mode.sharia}</div>
          <div className="mt-3 text-sm text-muted">{ar.briefing.capital}</div>
          <div className="num text-4xl font-bold text-gold">{fmtMoney(START_EQUITY)}</div>
        </div>
        {isHistoricalId(pending.scenarioId) && (
          <p className="mb-3 rounded-xl border border-gold/40 bg-gold/10 p-3 text-sm leading-relaxed text-gold">📜 {ar.hist.briefNote}</p>
        )}
        <ul className="space-y-3">
          {[...ar.briefing.rules, ...(pending.mode === 'sharia' ? [ar.briefing.shariaRule] : [])].map((r) => (
            <li key={r} className="flex gap-3 rounded-xl bg-surface p-3 leading-relaxed">
              <span className="text-gold">•</span><span>{r}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="safe-bottom px-4 pt-3">
        <Button variant="gold" className="w-full" onClick={startRound}>{ar.briefing.start}</Button>
      </div>
    </Screen>
  );
}
