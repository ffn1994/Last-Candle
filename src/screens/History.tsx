import { GradeBadge } from '../components/GradeBadge';
import { Header, Screen } from '../components/Screen';
import { ar } from '../i18n/ar';
import { useStore } from '../store';
import { SCENARIOS, getScenario } from '../data/scenarios';
import type { Grade } from '../game/scoring';
import { fmtPct } from '../format';

const ORDER: Grade[] = ['S', 'A', 'B', 'C', 'F'];

export function History() {
  const history = useStore((s) => s.history);
  const go = useStore.getState().go;

  const best = new Map<number, Grade>();
  for (const h of history) {
    if (h.daily) continue;
    const cur = best.get(h.scenarioId);
    if (!cur || ORDER.indexOf(h.grade) < ORDER.indexOf(cur)) best.set(h.scenarioId, h.grade);
  }

  return (
    <Screen>
      <Header title={ar.history.title} onBack={() => go('menu')} />
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {history.length === 0 ? (
          <p className="mt-16 text-center text-muted">{ar.history.empty}</p>
        ) : (
          <>
            <h2 className="mb-2 text-sm text-muted">{ar.history.best}</h2>
            <div className="mb-5 flex justify-between rounded-2xl bg-surface p-3">
              {SCENARIOS.map((sc) => {
                const g = best.get(sc.id);
                return (
                  <div key={sc.id} className="flex flex-col items-center gap-1">
                    {g ? <GradeBadge grade={g} size="sm" /> : <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-border text-muted">–</div>}
                    <span className="num text-xs text-muted">{sc.id}</span>
                  </div>
                );
              })}
            </div>
            <ul className="space-y-2">
              {history.map((h) => (
                <li key={h.id} className="flex items-center gap-3 rounded-2xl bg-surface p-3">
                  <GradeBadge grade={h.grade} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">
                      {h.name ?? getScenario(h.scenarioId).name}
                      {h.daily && <span className="mr-2 rounded bg-gold/15 px-1.5 text-xs text-gold">{ar.history.daily}</span>}
                      {h.mode === 'sharia' && <span className="mr-2 rounded bg-surface-2 px-1.5 text-xs text-muted">{ar.history.sharia}</span>}
                    </div>
                    <div className="flex gap-3 text-xs text-muted">
                      <span>{ar.history.return} <span className={`num ${h.returnPct >= 0 ? 'text-up' : 'text-down'}`}>{h.returnPct >= 0 ? '▲' : '▼'} {fmtPct(h.returnPct)}</span></span>
                      <span>{ar.history.dd} <span className="num text-down">▼ {h.maxDrawdownPct.toFixed(1)}%</span></span>
                    </div>
                  </div>
                  <div className="num text-xs text-muted">{new Date(h.date).toLocaleDateString('en-GB')}</div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Screen>
  );
}
