import {
  CandlestickSeries, ColorType, LineSeries, LineStyle, createChart, createSeriesMarkers,
  type IChartApi, type IPriceLine, type ISeriesApi, type SeriesMarker, type Time, type UTCTimestamp,
} from 'lightweight-charts';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Header, Screen } from '../components/Screen';
import { ar } from '../i18n/ar';
import { roundCandles, useStore } from '../store';
import { nervesTimeline, replayMarks } from '../game/replay';
import { fmtPrice, fmtSignedMoney, priceDigits } from '../format';

const DAY = 86_400;
const UP = '#16C784';
const DOWN = '#EA3943';

/** The finished round on one chart: every entry, exit and mistake, with the nerves line below. */
export function Replay() {
  const res = useStore((s) => s.lastResult);
  const go = useStore.getState().go;
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const lines = useRef<IPriceLine[]>([]);
  const [sel, setSel] = useState<number | null>(null);

  const r = res?.round;
  const candles = useMemo(() => (r ? roundCandles(r).slice(0, r.index + 1) : []), [r]);
  const marks = useMemo(() => (r ? replayMarks(r.trades, r.nervesLog) : []), [r]);
  const nerves = useMemo(() => (r ? nervesTimeline(r.nervesLog, 59, r.index) : []), [r]);

  useLayoutEffect(() => {
    if (!box.current || !candles.length) return;
    const c = createChart(box.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#848E9C', attributionLogo: false,
        fontFamily: 'IBM Plex Sans Arabic, system-ui, sans-serif', fontSize: 11,
        panes: { separatorColor: '#2A313B' },
      },
      grid: { vertLines: { color: '#1A2028' }, horzLines: { color: '#1A2028' } },
      rightPriceScale: { borderColor: '#2A313B' },
      timeScale: { borderColor: '#2A313B', rightOffset: 2, tickMarkFormatter: (t: UTCTimestamp) => String(Math.round(t / DAY)) },
      localization: { timeFormatter: (t: UTCTimestamp) => `#${Math.round(t / DAY)}`, priceFormatter: (p: number) => p.toFixed(priceDigits(p || 1)) },
      handleScroll: { horzTouchDrag: true, vertTouchDrag: false, mouseWheel: true, pressedMouseMove: true },
      handleScale: { pinch: true, mouseWheel: true, axisPressedMouseMove: true },
    });
    const s = c.addSeries(CandlestickSeries, {
      upColor: UP, downColor: DOWN, borderVisible: false, wickUpColor: UP, wickDownColor: DOWN, priceLineVisible: false, lastValueVisible: false,
    });
    s.setData(candles.map((k) => ({ ...k, time: k.time as UTCTimestamp })));

    const t = (i: number) => ((i + 1) * DAY) as UTCTimestamp;
    const label: Record<string, string> = ar.replay.tags;
    const list: SeriesMarker<Time>[] = marks.map((m) => {
      if (m.kind === 'entry') {
        const long = m.side === 'long';
        const bad = m.tags.includes('reckless') || m.tags.includes('revenge');
        return {
          time: t(m.i), position: long ? 'belowBar' : 'aboveBar', shape: long ? 'arrowUp' : 'arrowDown',
          color: bad ? '#F97316' : long ? UP : DOWN,
          text: [long ? ar.game.buy : ar.game.sell, ...m.tags.map((x) => label[x]).filter(Boolean)].join(' · '),
        };
      }
      if (m.kind === 'exit') {
        return { time: t(m.i), position: 'inBar', shape: 'circle', color: m.good ? UP : DOWN, text: label[m.tags[0]] ?? '' };
      }
      return { time: t(m.i), position: 'aboveBar', shape: 'square', color: '#F0B90B', text: ar.replay.tags.widen };
    });
    createSeriesMarkers(s, list);

    // nerves in their own pane, with the 30 danger line
    const n = c.addSeries(LineSeries, { color: '#F0B90B', lineWidth: 2, priceLineVisible: false, lastValueVisible: true }, 1);
    n.applyOptions({ autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }) });
    n.setData(nerves.map((x) => ({ time: t(x.i), value: x.v })));
    n.createPriceLine({ price: 30, color: DOWN, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false, title: ar.game.nerves });
    c.panes()[0]?.setStretchFactor(3);
    c.panes()[1]?.setStretchFactor(1);
    c.timeScale().setVisibleLogicalRange({ from: 50, to: candles.length + 1 });

    chart.current = c;
    series.current = s;
    return () => { c.remove(); chart.current = null; series.current = null; lines.current = []; };
  }, [candles, marks, nerves]);

  // the selected trade: zoom to it and draw its entry / exit
  useEffect(() => {
    const c = chart.current;
    const s = series.current;
    if (!c || !s || !r) return;
    for (const l of lines.current) s.removePriceLine(l);
    lines.current = [];
    if (sel === null) return;
    const tr = r.trades[sel];
    lines.current.push(
      s.createPriceLine({ price: tr.entry, color: '#EAECEF', lineStyle: LineStyle.Dashed, lineWidth: 1, title: ar.game.entry }),
      s.createPriceLine({ price: tr.exit, color: tr.pnl >= 0 ? UP : DOWN, lineStyle: LineStyle.Solid, lineWidth: 1, title: ar.replay.exit }),
    );
    c.timeScale().setVisibleLogicalRange({ from: tr.openedAt - 15, to: tr.closedAt + 15 });
  }, [sel, r]);

  if (!res || !r) return null;
  const tagText = (x: string) => (ar.replay.tags as Record<string, string>)[x];

  return (
    <Screen>
      <Header title={ar.replay.title} onBack={() => go('end')} />
      <div className="flex min-h-0 flex-1 flex-col gap-2 px-2 pb-2">
        <div dir="ltr" className="relative min-h-[18rem] flex-[3] overflow-hidden rounded-xl border border-border bg-surface">
          <div ref={box} className="absolute inset-0" />
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-[0.6875rem] text-muted">
          <span><span className="text-up">▲</span>/<span className="text-down">▼</span> {ar.replay.legendEntry}</span>
          <span>● {ar.replay.legendExit}</span>
          <span><span style={{ color: '#F97316' }}>▲</span> {ar.replay.legendMistake}</span>
          <span><span className="text-gold">■</span> {ar.replay.tags.widen}</span>
        </div>
        <div className="min-h-0 flex-[2] overflow-y-auto">
          {r.trades.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted">{ar.replay.noTrades}</p>
          ) : (
            <ul className="space-y-1.5">
              {r.trades.map((tr, k) => (
                <li key={k}>
                  <button
                    type="button" onClick={() => setSel(sel === k ? null : k)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-start text-sm active:scale-[0.99] ${
                      sel === k ? 'border-gold bg-gold/10' : 'border-border bg-surface'}`}
                  >
                    <span className={`font-bold ${tr.side === 'long' ? 'text-up' : 'text-down'}`}>{tr.side === 'long' ? ar.game.long : ar.game.short}</span>
                    <span className="min-w-0 flex-1 text-xs text-muted">
                      <span className="num">#{tr.openedAt + 1} → #{tr.closedAt + 1}</span>
                      {' · '}<span className="num">{fmtPrice(tr.entry)} → {fmtPrice(tr.exit)}</span>
                      {' · '}{tagText(tr.reason)}
                      {tr.reckless && <span className="mr-1 text-down"> · {tagText('reckless')}</span>}
                      {tr.revenge && <span className="mr-1 text-down"> · {tagText('revenge')}</span>}
                      {tr.analysis && <span className="mr-1 text-up"> · {tagText('analysis')}</span>}
                    </span>
                    <span className={`num font-bold ${tr.pnl >= 0 ? 'text-up' : 'text-down'}`}>{tr.pnl >= 0 ? '▲' : '▼'} {fmtSignedMoney(tr.pnl)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Screen>
  );
}
