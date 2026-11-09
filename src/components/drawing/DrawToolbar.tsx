import { ar } from '../../i18n/ar';
import type { DrawKind } from '../../game/drawings';
import { DRAW_COLORS } from './primitive';
import { haptic } from '../../fx';

const TOOLS: { kind: DrawKind; icon: string }[] = [
  { kind: 'hline', icon: '―' },
  { kind: 'trend', icon: '╱' },
  { kind: 'ray', icon: '↗' },
  { kind: 'rect', icon: '▭' },
  { kind: 'fib', icon: '≡' },
  { kind: 'text', icon: 'T' },
];

interface Props {
  tool: DrawKind | null;
  onTool: (t: DrawKind | null) => void;
  magnet: boolean;
  onMagnet: (on: boolean) => void;
  count: number;
  onClear: () => void;
}

export function DrawToolbar({ tool, onTool, magnet, onMagnet, count, onClear }: Props) {
  const btn = 'flex h-9 shrink-0 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold active:scale-95';
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1" role="toolbar" aria-label={ar.draw.title}>
      {TOOLS.map(({ kind, icon }) => {
        const on = tool === kind;
        return (
          <button
            key={kind} type="button" aria-pressed={on}
            onClick={() => { haptic(10); onTool(on ? null : kind); }}
            className={`${btn} ${on ? 'border-gold bg-gold text-bg' : 'border-border bg-surface-2'}`}
          >
            <span aria-hidden className="text-sm leading-none" style={on ? undefined : { color: DRAW_COLORS[kind] }}>{icon}</span>
            {ar.draw.tools[kind]}
          </button>
        );
      })}
      <span className="mx-0.5 h-6 w-px shrink-0 bg-border" />
      <button
        type="button" aria-pressed={magnet} onClick={() => onMagnet(!magnet)}
        className={`${btn} ${magnet ? 'border-gold/60 bg-gold/10 text-gold' : 'border-border bg-surface-2 text-muted'}`}
      >
        🧲 {ar.draw.magnet}
      </button>
      <button
        type="button" disabled={count === 0} onClick={onClear}
        className={`${btn} border-border bg-surface-2 text-muted disabled:opacity-40`}
      >
        🗑 {ar.draw.clear}
      </button>
    </div>
  );
}
