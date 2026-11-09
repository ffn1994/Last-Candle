import { ar } from '../i18n/ar';
import { LONG_RUN_PE, type Fundamentals, type ScheduledEvent, type Valuation } from '../data/fundamentals';
import { describeEvent } from '../game/eventText';

const VAL_COLOR: Record<Valuation, string> = {
  cheap: 'text-up border-up/50 bg-up/10',
  fair: 'text-text border-border bg-surface-2',
  high: 'text-gold border-gold/50 bg-gold/10',
  extreme: 'text-down border-down/50 bg-down/10',
};

const fgColor = (v: number) => (v < 25 ? '#EA3943' : v < 45 ? '#F97316' : v <= 55 ? '#848E9C' : v <= 75 ? '#84CC16' : '#16C784');

const EVENT_ICON = { earnings: '💼', rate: '🏦', cpi: '🛒' } as const;

/** Arrow + colour for a change; `upIsGood` decides which direction is green. */
function Delta({ now, before, upIsGood, digits = 1, suffix = '' }: { now: number; before: number; upIsGood: boolean; digits?: number; suffix?: string }) {
  const d = now - before;
  if (Math.abs(d) < 10 ** -digits / 2) return <span className="text-xs text-muted">=</span>;
  const good = d > 0 === upIsGood;
  return (
    <span className={`num text-xs ${good ? 'text-up' : 'text-down'}`}>
      {d > 0 ? '▲' : '▼'} {Math.abs(d).toFixed(digits)}{suffix}
    </span>
  );
}

export function FearGreedBar({ value }: { value: number }) {
  return (
    <div>
      <div className="relative h-2.5 rounded-full" style={{ background: 'linear-gradient(to left, #16C784, #84CC16, #848E9C, #F97316, #EA3943)' }}>
        {/* physical scale: fear (red, 0) on the left → greed (green, 100) on the right */}
        <span
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg shadow"
          style={{ left: `${value}%`, background: fgColor(value) }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[0.625rem] text-muted">
        <span>{ar.fund.mood.extremeGreed}</span>
        <span>{ar.fund.mood.extremeFear}</span>
      </div>
    </div>
  );
}

interface Props {
  f: Fundamentals;
  before: Fundamentals; // 20 candles earlier
  upcoming: ScheduledEvent[];
  index: number;
  lastEarnings: ScheduledEvent | null;
}

/** Full fundamentals view (inside a bottom sheet). */
export function FundamentalsPanel({ f, before, upcoming, index, lastEarnings }: Props) {
  const F = ar.fund;
  return (
    <div className="space-y-4 pb-3">
      {/* valuation */}
      <section className="rounded-2xl border border-border bg-surface-2 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">{F.pe}</span>
          {f.valuation && <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${VAL_COLOR[f.valuation]}`}>{F.valuation[f.valuation]}</span>}
        </div>
        {f.pe !== null ? (
          <>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="num text-4xl font-bold">{f.pe.toFixed(1)}</span>
              <Delta now={f.pe} before={before.pe ?? f.pe} upIsGood={false} />
            </div>
            <p className="mt-1 text-xs text-muted">{F.longRun(LONG_RUN_PE)} · {F.help.pe}</p>
          </>
        ) : (
          <>
            <div className="mt-1 text-2xl font-bold text-muted">{F.peNA}</div>
            <p className="mt-1 text-xs text-gold">{f.custom ? ar.builder.custom : F.peNote}</p>
          </>
        )}
      </section>

      {/* macro grid */}
      <section className="grid grid-cols-2 gap-2">
        {f.epsTtm !== null && (
          <div className="rounded-xl bg-surface-2 p-3">
            <div className="text-xs text-muted">{F.eps}</div>
            <div className="num text-lg font-bold">${f.epsTtm.toFixed(2)}</div>
            {f.epsGrowth !== null && (
              <span className={`num text-xs ${f.epsGrowth >= 0 ? 'text-up' : 'text-down'}`}>
                {f.epsGrowth >= 0 ? '▲' : '▼'} {Math.abs(f.epsGrowth * 100).toFixed(1)}% {F.epsGrowth}
              </span>
            )}
          </div>
        )}
        <div className="rounded-xl bg-surface-2 p-3">
          <div className="text-xs text-muted">{F.rate}</div>
          <div className="num text-lg font-bold">{f.rate.toFixed(2)}%</div>
          <Delta now={f.rate} before={before.rate} upIsGood={false} digits={2} suffix="%" />
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <div className="text-xs text-muted">{F.inflation}</div>
          <div className="num text-lg font-bold">{f.inflation.toFixed(1)}%</div>
          <Delta now={f.inflation} before={before.inflation} upIsGood={false} suffix="%" />
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <div className="text-xs text-muted">{F.unemployment}</div>
          <div className="num text-lg font-bold">{f.unemployment.toFixed(1)}%</div>
          <Delta now={f.unemployment} before={before.unemployment} upIsGood={false} suffix="%" />
        </div>
      </section>
      <p className="-mt-2 text-[0.6875rem] text-muted">{F.vs20} · {F.help.rate}</p>

      {/* sentiment */}
      <section className="rounded-2xl bg-surface-2 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-muted">{F.fearGreed}</span>
          <span className="font-bold" style={{ color: fgColor(f.fearGreed) }}>
            <span className="num">{f.fearGreed}</span> · {F.mood[f.mood]}
          </span>
        </div>
        <FearGreedBar value={f.fearGreed} />
        <p className="mt-2 text-xs text-muted">{F.help.fearGreed}</p>
      </section>

      {/* calendar */}
      <section>
        <h3 className="mb-2 text-sm font-semibold">📅 {F.calendar}</h3>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted">{F.calendarEmpty}</p>
        ) : (
          <ul className="space-y-1.5">
            {upcoming.map((e) => {
              const n = e.at - index;
              return (
                <li key={e.id} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${n <= 3 && e.blocking ? 'border border-gold/50 bg-gold/10' : 'bg-surface-2'}`}>
                  <span aria-hidden className="text-lg">{EVENT_ICON[e.kind]}</span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold">{ar.events[e.kind]}</span>
                    <span className="block text-xs text-muted">
                      {e.kind === 'earnings' && e.expected != null && <>{F.expected}: <span className="num">${e.expected.toFixed(2)}</span></>}
                      {e.kind === 'rate' && e.previous != null && <>{F.previous}: <span className="num">{e.previous.toFixed(2)}%</span></>}
                      {e.kind === 'cpi' && e.previous != null && <>{F.previous}: <span className="num">{e.previous.toFixed(1)}%</span></>}
                    </span>
                  </span>
                  <span className={`text-xs font-semibold ${n <= 3 ? 'text-gold' : 'text-muted'}`}>{F.inCandles(n)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {lastEarnings && (
        <section className="rounded-xl bg-surface-2 p-3">
          <div className="mb-1 text-xs text-muted">{F.lastEarnings} · #{lastEarnings.at + 1}</div>
          <p className="whitespace-pre-line text-sm">{describeEvent(lastEarnings).text}</p>
        </section>
      )}
    </div>
  );
}

/** One-line / small summary that opens the full panel. */
export function FundamentalsSummary({ f, next, index, onOpen, card }: {
  f: Fundamentals; next: ScheduledEvent | null; index: number; onOpen: () => void; card?: boolean;
}) {
  const F = ar.fund;
  const soon = next && next.blocking && next.at - index <= 3;
  return (
    <button
      type="button" onClick={onOpen}
      className={`flex w-full items-center gap-x-3 gap-y-1 text-start text-xs active:scale-[0.99] ${
        card ? 'flex-wrap rounded-xl border border-border bg-surface p-3' : 'overflow-hidden whitespace-nowrap px-4 py-1'}`}
      aria-label={F.title}
    >
      <span className="text-muted">📊</span>
      <span>
        <span className="text-muted">{F.pe} </span>
        {f.pe !== null ? (
          <span className={`num font-semibold ${f.valuation === 'extreme' ? 'text-down' : f.valuation === 'high' ? 'text-gold' : ''}`}>{f.pe.toFixed(0)}</span>
        ) : <span className="text-muted">—</span>}
      </span>
      <span><span className="text-muted">{F.rate} </span><span className="num font-semibold">{f.rate.toFixed(2)}%</span></span>
      <span style={{ color: fgColor(f.fearGreed) }}>{F.mood[f.mood]} <span className="num">{f.fearGreed}</span></span>
      {next && (
        <span className={`${soon ? 'font-semibold text-gold' : 'text-muted'}`}>
          {EVENT_ICON[next.kind]} {ar.events[next.kind]} · {F.inCandles(next.at - index)}
        </span>
      )}
    </button>
  );
}
