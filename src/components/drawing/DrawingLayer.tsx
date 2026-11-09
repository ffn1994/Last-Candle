import type { IChartApi, ISeriesApi, MouseEventParams, SeriesType, Time } from 'lightweight-charts';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ar } from '../../i18n/ar';
import { hitTest, newDrawingId, snapPrice, type DrawKind, type Drawing, type Pt } from '../../game/drawings';
import type { Candle } from '../../game/types';
import { DrawingsPrimitive, isDisposed } from './primitive';

interface Props {
  chart: IChartApi | null;
  series: ISeriesApi<SeriesType> | null;
  version: number; // bumps when the chart is rebuilt
  candles: Candle[]; // candles as displayed (daily or weekly)
  scale: number; // daily candles per displayed candle
  drawings: Drawing[];
  tool: DrawKind | null;
  magnet: boolean;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onAdd: (d: Drawing) => void;
  onUpdate: (d: Drawing) => void;
  onDelete: (id: string) => void;
  onToolDone: () => void;
  onTextAt: (pt: Pt) => void;
  onToggleAlert: (d: Drawing) => void;
}

type Handle = 'a' | 'b';

/** Run a cleanup that may hit an already-disposed chart. */
function safely(f: () => void) {
  try { f(); } catch { /* chart already removed */ }
}

function make(kind: DrawKind, a: Pt, b: Pt): Drawing {
  if (kind === 'hline') return { id: 'preview', kind, a: b };
  if (kind === 'text') return { id: 'preview', kind, a: b, text: '' };
  return { id: 'preview', kind, a, b };
}

export function DrawingLayer(p: Props) {
  const prim = useMemo(() => new DrawingsPrimitive(), []);
  const [preview, setPreview] = useState<Drawing | null>(null);
  const [drag, setDrag] = useState<Drawing | null>(null); // drawing being edited via a handle
  const [, setTick] = useState(0); // re-render handles when the view moves
  const [waiting, setWaiting] = useState(false); // first point placed by a tap, waiting for the second
  const pending = useRef<{ a: Pt; downX: number; downY: number; first: boolean } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  // attach to the (re)built series
  useEffect(() => {
    if (!p.series) return;
    p.series.attachPrimitive(prim);
    const s = p.series;
    return () => {
      if (isDisposed(s)) prim.detached(); // just drop our references to the dead chart
      else safely(() => s.detachPrimitive(prim));
    };
  }, [p.series, p.version, prim]);

  const shown = drag ? p.drawings.map((d) => (d.id === drag.id ? drag : d)) : p.drawings;
  useEffect(() => {
    prim.set({ drawings: shown, preview, selected: p.selected, scale: p.scale });
  });

  // keep the HTML handles glued to the chart while it pans / zooms
  useEffect(() => {
    const c = p.chart;
    if (!c) return;
    const bump = () => setTick((t) => t + 1);
    c.timeScale().subscribeVisibleLogicalRangeChange(bump);
    c.subscribeCrosshairMove(bump);
    // the chart may already be removed when the parent rebuilds it (e.g. switching chart type)
    return () => safely(() => { c.timeScale().unsubscribeVisibleLogicalRangeChange(bump); c.unsubscribeCrosshairMove(bump); });
  }, [p.chart, p.version]);

  // tapping a drawing (no tool active) selects it
  useEffect(() => {
    const c = p.chart;
    if (!c) return;
    const onClick = (e: MouseEventParams<Time>) => {
      if (p.tool || !e.point || (e.paneIndex ?? 0) !== 0) return;
      p.onSelect(hitTest(p.drawings, e.point, { toXY: prim.toXY, width: c.timeScale().width() }));
    };
    c.subscribeClick(onClick);
    return () => safely(() => c.unsubscribeClick(onClick));
  }, [p.chart, p.version, p.tool, p.drawings, p.onSelect, prim]); // eslint-disable-line react-hooks/exhaustive-deps

  // cancel a half-placed drawing when the tool changes
  useEffect(() => { pending.current = null; setPreview(null); setWaiting(false); }, [p.tool]);

  const ptAt = (clientX: number, clientY: number): Pt | null => {
    const c = p.chart;
    const s = p.series;
    const r = box.current?.getBoundingClientRect();
    if (!c || !s || !r) return null;
    const x = clientX - r.left;
    const y = clientY - r.top;
    const logical = c.timeScale().coordinateToLogical(x);
    const price = s.coordinateToPrice(y);
    if (logical == null || price == null) return null;
    if (!p.magnet) return { i: logical * p.scale, p: price };
    const i = Math.round(logical);
    return { i: i * p.scale, p: snapPrice(p.candles[i], price, (v) => s.priceToCoordinate(v)) };
  };

  // ---- placing a new drawing: drag from A to B, or tap A then tap B ----
  const finish = (kind: DrawKind, a: Pt, b: Pt) => {
    pending.current = null;
    setPreview(null);
    setWaiting(false);
    if (kind === 'text') p.onTextAt(b);
    else {
      const d = { ...make(kind, a, b), id: newDrawingId() } as Drawing;
      p.onAdd(d);
      p.onSelect(null);
    }
    p.onToolDone();
  };

  const onDown = (e: React.PointerEvent) => {
    const kind = p.tool;
    const pt = ptAt(e.clientX, e.clientY);
    if (!kind || !pt) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    if (kind === 'hline' || kind === 'text') return finish(kind, pt, pt);
    if (pending.current) return finish(kind, pending.current.a, pt); // second tap
    pending.current = { a: pt, downX: e.clientX, downY: e.clientY, first: true };
    setPreview(make(kind, pt, pt));
  };
  const onMove = (e: React.PointerEvent) => {
    const kind = p.tool;
    if (!kind || !pending.current) return;
    const pt = ptAt(e.clientX, e.clientY);
    if (pt) setPreview(make(kind, pending.current.a, pt));
  };
  const onUp = (e: React.PointerEvent) => {
    const kind = p.tool;
    const pd = pending.current;
    if (!kind || !pd || !pd.first) return;
    pd.first = false;
    const dragged = Math.hypot(e.clientX - pd.downX, e.clientY - pd.downY) > 10;
    const pt = ptAt(e.clientX, e.clientY);
    if (dragged && pt) finish(kind, pd.a, pt);
    else setWaiting(true); // tap-tap mode: wait for the second tap
  };

  // ---- editing the selected drawing ----
  const sel = p.selected ? shown.find((d) => d.id === p.selected) ?? null : null;
  const handles: { which: Handle; x: number; y: number }[] = [];
  if (sel && p.chart) {
    const a = prim.toXY(sel.a);
    if (a) {
      // a horizontal line has no meaningful x: put its handle a quarter in, clear of the action chips
      handles.push({ which: 'a', x: sel.kind === 'hline' ? p.chart.timeScale().width() * 0.25 : a.x, y: a.y });
    }
    if ('b' in sel) {
      const b = prim.toXY(sel.b);
      if (b) handles.push({ which: 'b', x: b.x, y: b.y });
    }
  }
  const startHandle = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    if (sel) setDrag(sel);
  };
  const moveHandle = (which: Handle) => (e: React.PointerEvent) => {
    if (!drag) return;
    const pt = ptAt(e.clientX, e.clientY);
    if (!pt) return;
    if (drag.kind === 'hline') setDrag({ ...drag, a: { ...drag.a, p: pt.p } });
    else setDrag({ ...drag, [which]: pt } as Drawing);
  };
  const endHandle = () => {
    if (drag) p.onUpdate(drag);
    setDrag(null);
  };

  const hint = !p.tool ? null
    : p.tool === 'hline' ? ar.draw.hintOne
    : p.tool === 'text' ? ar.draw.hintText
    : waiting ? ar.draw.hintSecond
    : ar.draw.hintTwo;

  const paneH = p.chart?.panes()[0]?.getHeight() ?? 0;
  const paneW = p.chart?.timeScale().width() ?? 0;
  // keep the delete / close chips away from the drawing being edited
  const chipsAtBottom = handles.length > 0 && Math.min(...handles.map((h) => h.y)) < paneH / 2;

  return (
    <div ref={box} className="pointer-events-none absolute left-0 top-0" style={{ width: paneW, height: paneH }}>
      {p.tool && (
        <div
          className="pointer-events-auto absolute inset-0 z-20 cursor-crosshair touch-none"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          aria-label={hint ?? ''}
        />
      )}
      {hint && (
        <div dir="rtl" className="absolute left-1/2 top-11 z-30 -translate-x-1/2 whitespace-nowrap rounded-full bg-gold px-3 py-1 text-xs font-semibold text-bg shadow-lg">
          {hint}
        </div>
      )}

      {sel && !p.tool && handles.map((h) => (
        <div
          key={h.which}
          className="pointer-events-auto absolute z-20 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 cursor-move items-center justify-center touch-none"
          style={{ left: h.x, top: h.y }}
          onPointerDown={startHandle}
          onPointerMove={moveHandle(h.which)}
          onPointerUp={endHandle}
          onPointerCancel={endHandle}
          role="slider"
          aria-label={ar.draw.selected}
        >
          <span className="h-4 w-4 rounded-full border-2 border-gold bg-bg shadow" />
        </div>
      ))}

      {sel && !p.tool && (
        <div dir="rtl" className={`pointer-events-auto absolute left-1/2 z-30 flex -translate-x-1/2 gap-1.5 ${chipsAtBottom ? 'bottom-3' : 'top-11'}`}>
          <button
            type="button" onClick={() => { p.onDelete(sel.id); p.onSelect(null); }}
            className="flex h-8 items-center gap-1 rounded-full bg-down px-3 text-xs font-semibold text-white shadow-lg active:scale-95"
          >
            🗑 {ar.draw.delete}
          </button>
          {sel.kind === 'hline' && (
            <button
              type="button" aria-pressed={!!sel.alert} onClick={() => p.onToggleAlert(sel)}
              className={`flex h-8 items-center gap-1 rounded-full px-3 text-xs font-semibold shadow-lg active:scale-95 ${
                sel.alert ? 'bg-gold text-bg' : 'bg-surface-2 text-text'}`}
            >
              🔔 {sel.alert ? ar.draw.alertOn : ar.draw.alert}
            </button>
          )}
          <button
            type="button" onClick={() => p.onSelect(null)} aria-label={ar.draw.cancel}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-xs text-muted shadow-lg active:scale-95"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
