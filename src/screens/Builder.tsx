import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { Header, Screen } from '../components/Screen';
import { ar } from '../i18n/ar';
import { useStore } from '../store';
import { generateCandles } from '../data/scenarios';
import {
  LEN, MAX_MULT, MIN_MULT, TEMPLATES, applyStroke, flatPath, nextCustomId, smooth, toScenario,
  type CustomMarket, type TemplateId, type Volatility,
} from '../game/customMarket';
import { HISTORY_CANDLES } from '../game/engine';
import { haptic } from '../fx';

const LOG_MAX = Math.log(MAX_MULT);
const LOG_RANGE = Math.log(MAX_MULT) - Math.log(MIN_MULT);
const GRID = [3, 2, 1.5, 1, 0.67, 0.5, 1 / 3];

/** Draw the market's trend with a finger; candles are generated to follow it. */
export function Builder() {
  const editing = useStore((s) => s.editing);
  const customs = useStore((s) => s.customs);
  const { saveCustom, go } = useStore.getState();
  const existing = editing !== null ? customs.find((m) => m.id === editing) ?? null : null;

  const [name, setName] = useState(existing?.name ?? '');
  const [path, setPath] = useState<number[]>(existing?.path ?? TEMPLATES.crashRecovery());
  const [vol, setVol] = useState<Volatility>(existing?.vol ?? 'normal');
  const [seed, setSeed] = useState(7);
  const [size, setSize] = useState({ w: 320, h: 260 });
  const box = useRef<HTMLDivElement>(null);
  const last = useRef<{ i: number; v: number } | null>(null);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const draft: CustomMarket = { id: existing?.id ?? nextCustomId(customs), name: name.trim() || ar.builder.untitled, path, vol, createdAt: existing?.createdAt ?? Date.now() };
  // live preview (not while the finger is down, to keep drawing smooth)
  const candles = useMemo(
    () => generateCandles(toScenario(draft), seed),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drawing ? null : path, vol, seed],
  );

  const { w, h } = size;
  const x = (i: number) => (i / (LEN - 1)) * w;
  const y = (mult: number) => ((LOG_MAX - Math.log(mult)) / LOG_RANGE) * h;
  const toPoint = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    const i = ((e.clientX - r.left) / r.width) * (LEN - 1);
    const v = Math.exp(LOG_MAX - ((e.clientY - r.top) / r.height) * LOG_RANGE);
    return { i, v: Math.max(MIN_MULT, Math.min(MAX_MULT, v)) };
  };

  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const pt = toPoint(e);
    last.current = pt;
    setDrawing(true);
    setPath((p) => applyStroke(p, pt.i, pt.v, pt.i, pt.v));
  };
  const onMove = (e: React.PointerEvent) => {
    if (!last.current) return;
    const pt = toPoint(e);
    const prev = last.current;
    last.current = pt;
    setPath((p) => applyStroke(p, prev.i, prev.v, pt.i, pt.v));
  };
  const onUp = () => {
    if (!last.current) return;
    last.current = null;
    setDrawing(false);
    setPath((p) => smooth(p));
  };

  const base = candles[0]?.open ?? 100;
  const line = path.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const cw = Math.max(1, (w / LEN) * 0.7);
  const change = (path[LEN - 1] / path[0] - 1) * 100;
  const peak = Math.max(...path) / path[0];
  const trough = Math.min(...path) / path[0];

  const save = (play: boolean) => {
    haptic(15);
    saveCustom({ ...draft, path: smooth(path), name: name.trim() || ar.builder.untitled });
    if (play) useStore.getState().prepare({ mode: useStore.getState().modePick ?? 'normal', scenarioId: draft.id });
    else go('mode');
  };

  return (
    <Screen>
      <Header title={existing ? ar.builder.editTitle : ar.builder.title} onBack={() => go('mode')} />
      <div className="flex-1 space-y-3 px-4 pb-4">
        <input
          value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder={ar.builder.namePlaceholder}
          className="h-11 w-full rounded-xl border border-border bg-surface-2 px-3 outline-none focus:border-gold"
        />

        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {(Object.keys(TEMPLATES) as TemplateId[]).map((t) => (
            <button
              key={t} type="button" onClick={() => { haptic(10); setPath(TEMPLATES[t]()); }}
              className="h-9 shrink-0 rounded-lg border border-border bg-surface-2 px-3 text-xs font-semibold active:scale-95"
            >
              {ar.builder.templates[t]}
            </button>
          ))}
          <button type="button" onClick={() => setPath(flatPath())} className="h-9 shrink-0 rounded-lg border border-border bg-surface-2 px-3 text-xs text-muted active:scale-95">
            {ar.builder.clear}
          </button>
        </div>

        <p className="text-sm text-muted">✍️ {ar.builder.hint}</p>

        {/* drawing canvas: time runs left → right like every chart */}
        <div
          ref={box} dir="ltr"
          className="relative h-[16rem] w-full cursor-crosshair touch-none overflow-hidden rounded-xl border border-border bg-surface short:h-[11rem]"
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          role="img" aria-label={ar.builder.canvas}
        >
          <svg width={w} height={h} className="absolute inset-0">
            <rect x={0} y={0} width={x(HISTORY_CANDLES)} height={h} fill="rgba(132,142,156,0.08)" />
            <text x={6} y={h - 8} fontSize={10} fill="#848E9C">{ar.builder.history}</text>
            {GRID.map((g) => (
              <g key={g}>
                <line x1={0} x2={w} y1={y(g)} y2={y(g)} stroke={g === 1 ? '#3A424D' : '#1E242C'} strokeDasharray={g === 1 ? '4 4' : undefined} />
                <text x={w - 4} y={y(g) - 3} fontSize={9} fill="#848E9C" textAnchor="end">{g >= 1 ? `+${Math.round((g - 1) * 100)}%` : `${Math.round((g - 1) * 100)}%`}</text>
              </g>
            ))}
            {/* generated candles, faded behind the drawing */}
            <g opacity={drawing ? 0.25 : 0.7}>
              {candles.map((c, i) => {
                const up = c.close >= c.open;
                const top = y(Math.max(c.open, c.close) / base * path[0]);
                const bot = y(Math.min(c.open, c.close) / base * path[0]);
                return (
                  <g key={i} stroke={up ? '#16C784' : '#EA3943'} fill={up ? '#16C784' : '#EA3943'}>
                    <line x1={x(i)} x2={x(i)} y1={y(c.high / base * path[0])} y2={y(c.low / base * path[0])} strokeWidth={0.7} />
                    <rect x={x(i) - cw / 2} y={top} width={cw} height={Math.max(0.8, bot - top)} />
                  </g>
                );
              })}
            </g>
            <path d={line} fill="none" stroke="#F0B90B" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
          </svg>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl bg-surface p-2"><div className="text-muted">{ar.builder.change}</div><div className={`num font-bold ${change >= 0 ? 'text-up' : 'text-down'}`}>{change >= 0 ? '▲ +' : '▼ '}{change.toFixed(0)}%</div></div>
          <div className="rounded-xl bg-surface p-2"><div className="text-muted">{ar.builder.peak}</div><div className="num font-bold text-up">+{((peak - 1) * 100).toFixed(0)}%</div></div>
          <div className="rounded-xl bg-surface p-2"><div className="text-muted">{ar.builder.trough}</div><div className="num font-bold text-down">{((trough - 1) * 100).toFixed(0)}%</div></div>
        </div>

        <section>
          <h3 className="mb-2 text-sm text-muted">{ar.builder.volatility}</h3>
          <div className="grid grid-cols-3 gap-2">
            {(['calm', 'normal', 'wild'] as Volatility[]).map((v) => (
              <button
                key={v} type="button" onClick={() => setVol(v)}
                className={`h-11 rounded-xl border text-sm font-semibold ${vol === v ? 'border-gold bg-gold text-bg' : 'border-border bg-surface-2'}`}
              >
                {ar.builder.vol[v]}
              </button>
            ))}
          </div>
        </section>

        <Button variant="secondary" size="md" className="w-full" onClick={() => setSeed((s) => s + 1)}>🎲 {ar.builder.reroll}</Button>
      </div>
      <div className="safe-bottom flex gap-3 px-4 pt-2">
        <Button variant="gold" className="flex-[2]" onClick={() => save(true)}>{ar.builder.savePlay}</Button>
        <Button variant="secondary" className="flex-1" onClick={() => save(false)}>{ar.builder.save}</Button>
      </div>
    </Screen>
  );
}
