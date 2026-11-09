import {
  CandlestickSeries, ColorType, CrosshairMode, HistogramSeries, LineSeries, LineStyle, createChart,
  type IChartApi, type IPriceLine, type ISeriesApi, type LogicalRange, type SeriesType, type UTCTimestamp,
} from 'lightweight-charts';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ar } from '../i18n/ar';
import { fmtPrice, priceDigits } from '../format';
import { bollinger, ema, macd, rsi, sma, type Series } from '../game/indicators';
import type { Candle, Position } from '../game/types';
import { MACD_SIGNAL_COLOR, indicatorDef, type IndicatorId } from './indicatorDefs';
import { DrawingLayer } from './drawing/DrawingLayer';
import type { ComponentProps } from 'react';

/** Drawing props passed through to the drawing layer (the chart supplies the rest). */
export type DrawingProps = Omit<ComponentProps<typeof DrawingLayer>, 'chart' | 'series' | 'version' | 'candles'>;

interface Props {
  candles: Candle[]; // visible candles (the last one may be forming)
  dataKey: string; // changes when the underlying round changes → full redraw
  position: Position | null;
  indicators: IndicatorId[];
  onStopCommit: (price: number) => void;
  drawing: DrawingProps;
}

const DAY = 86_400;
const VISIBLE = 60;
const UP = '#16C784';
const DOWN = '#EA3943';

/** One drawable line/histogram derived from closes. */
interface Spec {
  key: string;
  ind: IndicatorId;
  pane: number;
  kind: 'line' | 'hist';
  color: string;
  dashed?: boolean;
  calc: (closes: number[]) => Series;
  legend?: string; // label in the legend (price-pane overlays only)
}

function specsFor(ids: IndicatorId[]): Spec[] {
  const out: Spec[] = [];
  let pane = 1;
  for (const id of ids) {
    const d = indicatorDef(id);
    switch (id) {
      case 'ma20': out.push({ key: id, ind: id, pane: 0, kind: 'line', color: d.color, calc: (c) => sma(c, 20), legend: d.short }); break;
      case 'ma50': out.push({ key: id, ind: id, pane: 0, kind: 'line', color: d.color, calc: (c) => sma(c, 50), legend: d.short }); break;
      case 'ma100': out.push({ key: id, ind: id, pane: 0, kind: 'line', color: d.color, calc: (c) => sma(c, 100), legend: d.short }); break;
      case 'ema20': out.push({ key: id, ind: id, pane: 0, kind: 'line', color: d.color, calc: (c) => ema(c, 20), legend: d.short }); break;
      case 'bb':
        out.push(
          { key: 'bbU', ind: id, pane: 0, kind: 'line', color: d.color, calc: (c) => bollinger(c).upper, legend: 'BB ↑' },
          { key: 'bbM', ind: id, pane: 0, kind: 'line', color: d.color, dashed: true, calc: (c) => bollinger(c).mid },
          { key: 'bbL', ind: id, pane: 0, kind: 'line', color: d.color, calc: (c) => bollinger(c).lower, legend: 'BB ↓' },
        );
        break;
      case 'rsi':
        out.push({ key: id, ind: id, pane: pane++, kind: 'line', color: d.color, calc: (c) => rsi(c) });
        break;
      case 'macd': {
        const p = pane++;
        out.push(
          { key: 'macdH', ind: id, pane: p, kind: 'hist', color: d.color, calc: (c) => macd(c).hist },
          { key: 'macdL', ind: id, pane: p, kind: 'line', color: d.color, calc: (c) => macd(c).line },
          { key: 'macdS', ind: id, pane: p, kind: 'line', color: MACD_SIGNAL_COLOR, calc: (c) => macd(c).signal },
        );
        break;
      }
    }
  }
  return out;
}

const fmtVol = (v: number) =>
  v >= 1e9 ? `${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}K` : v.toFixed(0);

export function CandleChart({ candles, dataKey, position, indicators, onStopCommit, drawing }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const main = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const vol = useRef<ISeriesApi<'Histogram'> | null>(null);
  const extra = useRef(new Map<string, ISeriesApi<SeriesType>>());
  const lines = useRef<{ entry?: IPriceLine; stop?: IPriceLine; tp?: IPriceLine }>({});
  const prev = useRef({ len: 0, key: '' });
  // zoom/scroll kept across chart rebuilds (toggling indicators) for the same round
  const savedRange = useRef<{ range: LogicalRange | null; key: string } | null>(null);
  const lenRef = useRef(candles.length);
  lenRef.current = candles.length;

  const [version, setVersion] = useState(0);
  const [atEnd, setAtEnd] = useState(true);
  const [hover, setHover] = useState<number | null>(null);
  const [stopY, setStopY] = useState<number | null>(null);
  const [dragPrice, setDragPrice] = useState<number | null>(null);
  const dragRef = useRef<number | null>(null);
  dragRef.current = dragPrice;
  const stopRef = useRef<number | null>(null);
  stopRef.current = position?.stop ?? null;

  const indKey = indicators.join(',');
  const specs = useMemo(() => specsFor(indicators), [indKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const computed = useMemo(() => {
    const closes = candles.map((c) => c.close);
    return new Map(specs.map((s) => [s.key, s.calc(closes)]));
  }, [candles, specs]);

  const placeHandle = () => {
    const s = main.current;
    const c = chart.current;
    const price = dragRef.current ?? stopRef.current;
    if (!s || !c || price == null) return setStopY(null);
    const y = s.priceToCoordinate(price);
    const h = c.panes()[0]?.getHeight() ?? 0;
    setStopY(y == null ? null : Math.max(12, Math.min(h - 12, y)));
  };

  // (Re)create the chart whenever the set of indicators (and so the panes) changes.
  useLayoutEffect(() => {
    if (!box.current) return;
    const c = createChart(box.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#848E9C',
        fontFamily: 'IBM Plex Sans Arabic, system-ui, sans-serif',
        // follow the root font size so the chart scales with the UI on big screens / TVs
        fontSize: Math.round(11 * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16),
        attributionLogo: false,
        panes: { separatorColor: '#2A313B', separatorHoverColor: 'rgba(240,185,11,0.15)', enableResize: true },
      },
      grid: { vertLines: { color: '#1A2028' }, horzLines: { color: '#1A2028' } },
      rightPriceScale: { borderColor: '#2A313B', scaleMargins: { top: 0.16, bottom: 0.08 } },
      timeScale: {
        borderColor: '#2A313B',
        rightOffset: 4,
        barSpacing: 7,
        minBarSpacing: 2,
        shiftVisibleRangeOnNewBar: true,
        // real dates would reveal the scenario, so label by candle number
        tickMarkFormatter: (t: UTCTimestamp) => String(Math.round(t / DAY)),
      },
      localization: {
        timeFormatter: (t: UTCTimestamp) => `#${Math.round(t / DAY)}`,
        priceFormatter: (p: number) => p.toFixed(priceDigits(Math.abs(p) || 1)),
      },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: '#848E9C', labelBackgroundColor: '#1E242C' }, horzLine: { color: '#848E9C', labelBackgroundColor: '#1E242C' } },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: { time: true, price: true }, axisDoubleClickReset: true },
      kineticScroll: { touch: true, mouse: false },
    });

    main.current = c.addSeries(CandlestickSeries, {
      upColor: UP, downColor: DOWN, borderVisible: false, wickUpColor: UP, wickDownColor: DOWN,
      priceLineVisible: true, priceLineStyle: LineStyle.Dashed, priceLineWidth: 1, lastValueVisible: true,
    });
    vol.current = c.addSeries(HistogramSeries, {
      priceScaleId: 'vol', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false,
    });
    c.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 }, visible: false });

    const m = extra.current;
    m.clear();
    for (const s of specs) {
      const common = { lastValueVisible: s.pane > 0, priceLineVisible: false, crosshairMarkerVisible: false };
      const series = s.kind === 'hist'
        ? c.addSeries(HistogramSeries, { ...common, color: s.color }, s.pane)
        : c.addSeries(LineSeries, { ...common, color: s.color, lineWidth: s.pane === 0 ? 2 : 1, lineStyle: s.dashed ? LineStyle.Dashed : LineStyle.Solid }, s.pane);
      if (s.ind === 'rsi') {
        series.applyOptions({ autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }) });
        for (const lvl of [70, 30]) series.createPriceLine({ price: lvl, color: '#2A313B', lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: '' });
      }
      m.set(s.key, series);
    }
    const panes = c.panes();
    panes[0]?.setStretchFactor(3);
    for (let i = 1; i < panes.length; i++) panes[i].setStretchFactor(1);

    const onRange = (r: LogicalRange | null) => {
      setAtEnd(!r || r.to >= lenRef.current - 1.5);
      placeHandle();
    };
    const onCross = (p: { logical?: number; point?: unknown }) => {
      setHover(p.point && p.logical != null ? Math.round(p.logical) : null);
      placeHandle();
    };
    c.timeScale().subscribeVisibleLogicalRangeChange(onRange);
    c.subscribeCrosshairMove(onCross);

    chart.current = c;
    prev.current = { len: 0, key: '' };
    lines.current = {};
    setVersion((v) => v + 1);
    return () => {
      savedRange.current = { range: c.timeScale().getVisibleLogicalRange(), key: prev.current.key };
      c.timeScale().unsubscribeVisibleLogicalRangeChange(onRange);
      c.unsubscribeCrosshairMove(onCross);
      c.remove();
      chart.current = null;
      main.current = null;
      vol.current = null;
    };
  }, [specs]); // eslint-disable-line react-hooks/exhaustive-deps

  // data
  useEffect(() => {
    const c = chart.current;
    const s = main.current;
    const v = vol.current;
    if (!c || !s || !v || !candles.length) return;
    const n = candles.length;
    const p = prev.current;
    const incremental = p.key === dataKey && p.len > 0 && (n === p.len || n === p.len + 1);
    const t = (k: Candle) => k.time as UTCTimestamp;

    const volData = (k: Candle) => ({
      time: t(k), value: k.volume ?? 0, color: k.close >= k.open ? 'rgba(22,199,132,0.35)' : 'rgba(234,57,67,0.35)',
    });
    const pointAt = (spec: Spec, vals: Series, i: number) => {
      const val = vals[i];
      const time = t(candles[i]);
      if (val == null) return { time };
      if (spec.kind === 'hist') return { time, value: val, color: val >= 0 ? 'rgba(22,199,132,0.5)' : 'rgba(234,57,67,0.5)' };
      return { time, value: val };
    };

    if (incremental) {
      const last = candles[n - 1];
      s.update({ ...last, time: t(last) });
      v.update(volData(last));
      for (const spec of specs) extra.current.get(spec.key)?.update(pointAt(spec, computed.get(spec.key)!, n - 1));
    } else {
      s.setData(candles.map((k) => ({ ...k, time: t(k) })));
      v.setData(candles.map(volData));
      for (const spec of specs) {
        const vals = computed.get(spec.key)!;
        extra.current.get(spec.key)?.setData(candles.map((_, i) => pointAt(spec, vals, i)));
      }
      const saved = savedRange.current;
      const keep = saved && saved.key === dataKey ? saved.range : null;
      c.timeScale().setVisibleLogicalRange(keep ?? { from: n - VISIBLE, to: n + 3 });
      savedRange.current = null;
    }
    prev.current = { len: n, key: dataKey };
    requestAnimationFrame(placeHandle);
  }, [candles, computed, dataKey, version]); // eslint-disable-line react-hooks/exhaustive-deps

  // entry / stop / take-profit lines
  useEffect(() => {
    const s = main.current;
    if (!s) return;
    const L = lines.current;
    for (const k of ['entry', 'stop', 'tp'] as const) {
      if (L[k]) s.removePriceLine(L[k]!);
      L[k] = undefined;
    }
    if (position) {
      L.entry = s.createPriceLine({ price: position.entry, color: '#EAECEF', lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: ar.game.entry });
      const stop = dragPrice ?? position.stop;
      if (stop != null) L.stop = s.createPriceLine({ price: stop, color: DOWN, lineStyle: LineStyle.Solid, lineWidth: 2, axisLabelVisible: true, title: ar.game.stop });
      if (position.tp != null) L.tp = s.createPriceLine({ price: position.tp, color: UP, lineStyle: LineStyle.Solid, lineWidth: 2, axisLabelVisible: true, title: ar.game.tp });
    }
    requestAnimationFrame(placeHandle);
  }, [position, dragPrice, version]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ro = new ResizeObserver(() => requestAnimationFrame(placeHandle));
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // stop dragging
  const priceFromEvent = (e: React.PointerEvent) => {
    const rect = box.current!.getBoundingClientRect();
    return main.current?.coordinateToPrice(e.clientY - rect.top) ?? null;
  };
  const onDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const p = priceFromEvent(e);
    if (p != null) setDragPrice(p);
  };
  const onMove = (e: React.PointerEvent) => {
    if (dragPrice == null) return;
    const p = priceFromEvent(e);
    if (p != null && p > 0) setDragPrice(p);
  };
  const onUp = () => {
    if (dragPrice != null) onStopCommit(dragPrice);
    setDragPrice(null);
  };

  const goLast = () => {
    const c = chart.current;
    if (!c) return;
    c.timeScale().scrollToRealTime();
    c.priceScale('right').applyOptions({ autoScale: true });
  };

  // legend: hovered candle, else the latest
  const n = candles.length;
  const i = hover == null ? n - 1 : Math.max(0, Math.min(n - 1, hover));
  const k = candles[i];
  const pc = i > 0 ? candles[i - 1].close : k?.open;
  const chg = k && pc ? ((k.close - pc) / pc) * 100 : 0;
  const up = chg >= 0;
  const overlays = specs.filter((s) => s.pane === 0 && s.legend);

  return (
    <div dir="ltr" className="relative h-full w-full">
      <div ref={box} className="absolute inset-0" />
      <DrawingLayer chart={chart.current} series={main.current} version={version} candles={candles} {...drawing} />

      {k && (
        <div dir="rtl" className="pointer-events-none absolute left-2 top-1 z-10 max-w-[calc(100%-72px)] text-[0.6875rem] leading-4">
          <div className="flex flex-wrap gap-x-2">
            {([['open', k.open], ['high', k.high], ['low', k.low], ['close', k.close]] as const).map(([lbl, val]) => (
              <span key={lbl} className="text-muted">
                {ar.chart[lbl]} <span className={`num ${up ? 'text-up' : 'text-down'}`}>{fmtPrice(val)}</span>
              </span>
            ))}
            <span className={`num font-semibold ${up ? 'text-up' : 'text-down'}`}>{up ? '▲' : '▼'} {up ? '+' : ''}{chg.toFixed(2)}%</span>
          </div>
          <div className="flex flex-wrap gap-x-2">
            {k.volume != null && <span className="text-muted">{ar.chart.volume} <span className="num text-text">{fmtVol(k.volume)}</span></span>}
            {overlays.map((s) => {
              const val = computed.get(s.key)?.[i];
              return val == null ? null : (
                <span key={s.key} style={{ color: s.color }}><span dir="ltr">{s.legend}</span> <span className="num">{fmtPrice(val)}</span></span>
              );
            })}
          </div>
        </div>
      )}

      {!atEnd && (
        <button
          type="button" onClick={goLast}
          className="absolute bottom-9 right-[4.4rem] z-20 flex h-9 items-center gap-1 rounded-full border border-gold/50 bg-surface-2/95 px-3 text-xs font-semibold text-gold shadow-lg active:scale-95"
        >
          <span dir="rtl">{ar.chart.lastCandle}</span> <span aria-hidden>⇥</span>
        </button>
      )}

      {position?.stop != null && stopY != null && (
        <div
          className="absolute inset-x-0 z-10 flex h-8 -translate-y-1/2 cursor-ns-resize items-center touch-none"
          style={{ top: stopY, right: 64 }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          aria-label={ar.game.dragStop}
          role="slider"
          aria-valuenow={dragPrice ?? position.stop}
        >
          <span className="ml-2 rounded-md bg-down px-2 py-0.5 text-xs font-semibold text-white shadow" dir="rtl">
            ⇕ {ar.game.dragStop}
          </span>
        </div>
      )}
    </div>
  );
}
