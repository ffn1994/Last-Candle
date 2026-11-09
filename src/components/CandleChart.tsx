import {
  CandlestickSeries, ColorType, CrosshairMode, LineStyle, createChart,
  type IChartApi, type IPriceLine, type ISeriesApi, type UTCTimestamp,
} from 'lightweight-charts';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ar } from '../i18n/ar';
import { priceDigits } from '../format';
import type { Candle, Position } from '../game/types';

interface Props {
  candles: Candle[]; // visible candles only
  position: Position | null;
  onStopCommit: (price: number) => void;
}

const DAY = 86_400;
const VISIBLE = 60;

export function CandleChart({ candles, position, onStopCommit }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const lines = useRef<{ entry?: IPriceLine; stop?: IPriceLine; tp?: IPriceLine }>({});
  const prevLen = useRef(0);
  const [stopY, setStopY] = useState<number | null>(null);
  const [dragPrice, setDragPrice] = useState<number | null>(null);

  // create once
  useLayoutEffect(() => {
    if (!box.current) return;
    const c = createChart(box.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#848E9C',
        fontFamily: 'IBM Plex Sans Arabic, system-ui, sans-serif',
        attributionLogo: false,
      },
      grid: { vertLines: { color: '#1E242C' }, horzLines: { color: '#1E242C' } },
      rightPriceScale: { borderColor: '#2A313B', scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: {
        borderColor: '#2A313B',
        rightOffset: 3,
        // hide real dates: label by candle number
        tickMarkFormatter: (t: UTCTimestamp) => String(Math.round(t / DAY)),
      },
      localization: {
        timeFormatter: (t: UTCTimestamp) => `#${Math.round(t / DAY)}`,
        priceFormatter: (p: number) => p.toFixed(priceDigits(p)),
      },
      crosshair: { mode: CrosshairMode.Magnet },
      handleScroll: false,
      handleScale: false,
    });
    series.current = c.addSeries(CandlestickSeries, {
      upColor: '#16C784', downColor: '#EA3943', borderVisible: false,
      wickUpColor: '#16C784', wickDownColor: '#EA3943',
    });
    chart.current = c;
    return () => {
      c.remove();
      chart.current = null;
      series.current = null;
      lines.current = {};
      prevLen.current = 0;
    };
  }, []);

  const placeHandle = useCallback(() => {
    const s = series.current;
    const price = dragPrice ?? position?.stop;
    if (!s || price == null) return setStopY(null);
    setStopY(s.priceToCoordinate(price));
  }, [dragPrice, position?.stop]);

  // data
  useEffect(() => {
    const s = series.current;
    const c = chart.current;
    if (!s || !c) return;
    const data = candles.map((k) => ({ ...k, time: k.time as UTCTimestamp }));
    if (candles.length === prevLen.current + 1 && prevLen.current > 0) s.update(data[data.length - 1]);
    else s.setData(data);
    prevLen.current = candles.length;
    c.timeScale().setVisibleLogicalRange({ from: candles.length - VISIBLE, to: candles.length + 2 });
    requestAnimationFrame(placeHandle);
  }, [candles, placeHandle]);

  // price lines
  useEffect(() => {
    const s = series.current;
    if (!s) return;
    const L = lines.current;
    for (const k of ['entry', 'stop', 'tp'] as const) {
      if (L[k]) s.removePriceLine(L[k]!);
      L[k] = undefined;
    }
    if (position) {
      L.entry = s.createPriceLine({ price: position.entry, color: '#EAECEF', lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: ar.game.entry });
      const stop = dragPrice ?? position.stop;
      if (stop != null) L.stop = s.createPriceLine({ price: stop, color: '#EA3943', lineStyle: LineStyle.Solid, lineWidth: 2, axisLabelVisible: true, title: ar.game.stop });
      if (position.tp != null) L.tp = s.createPriceLine({ price: position.tp, color: '#16C784', lineStyle: LineStyle.Solid, lineWidth: 2, axisLabelVisible: true, title: ar.game.tp });
    }
    requestAnimationFrame(placeHandle);
  }, [position, dragPrice, placeHandle]);

  useEffect(() => {
    const ro = new ResizeObserver(() => requestAnimationFrame(placeHandle));
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, [placeHandle]);

  // stop dragging
  const priceFromEvent = (e: React.PointerEvent) => {
    const rect = box.current!.getBoundingClientRect();
    return series.current?.coordinateToPrice(e.clientY - rect.top) ?? null;
  };
  const onDown = (e: React.PointerEvent) => {
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

  const h = box.current?.clientHeight ?? 0;
  const y = stopY == null ? null : Math.max(12, Math.min(h - 12, stopY));

  return (
    <div dir="ltr" className="relative h-full w-full">
      <div ref={box} className="absolute inset-0" />
      {position?.stop != null && y != null && (
        <div
          className="absolute inset-x-0 z-10 flex h-8 -translate-y-1/2 cursor-ns-resize items-center touch-none"
          style={{ top: y }}
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
