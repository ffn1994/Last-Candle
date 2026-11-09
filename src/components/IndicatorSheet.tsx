import { BottomSheet } from './BottomSheet';
import { ar } from '../i18n/ar';
import { INDICATORS, MAX_INDICATORS, type IndicatorId } from './indicatorDefs';
import { haptic } from '../fx';

interface Props {
  open: boolean;
  active: IndicatorId[];
  onToggle: (id: IndicatorId) => void;
  onClose: () => void;
}

export function IndicatorSheet({ open, active, onToggle, onClose }: Props) {
  const full = active.length >= MAX_INDICATORS;
  return (
    <BottomSheet open={open} onClose={onClose} title={ar.chart.indicators}>
      <p className={`mb-3 text-sm ${full ? 'text-gold' : 'text-muted'}`}>{full ? ar.chart.maxReached : ar.chart.indicatorsHint}</p>
      <ul className="space-y-2 pb-3">
        {INDICATORS.map((d) => {
          const on = active.includes(d.id);
          const disabled = !on && full;
          return (
            <li key={d.id}>
              <button
                type="button" role="switch" aria-checked={on} disabled={disabled}
                onClick={() => { haptic(10); onToggle(d.id); }}
                className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border px-3 py-2 text-start transition ${
                  on ? 'border-gold/60 bg-gold/10' : 'border-border bg-surface-2'} ${disabled ? 'opacity-40' : ''}`}
              >
                <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: d.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{ar.chart.ind[d.id].name}</span>
                  <span className="block text-xs text-muted">{ar.chart.ind[d.id].desc}</span>
                </span>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-sm ${on ? 'border-gold bg-gold text-bg' : 'border-border'}`}>
                  {on ? '✓' : ''}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </BottomSheet>
  );
}
