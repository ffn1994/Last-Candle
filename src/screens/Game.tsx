import { motion, useAnimationControls } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { CandleChart } from '../components/CandleChart';
import { IndicatorSheet } from '../components/IndicatorSheet';
import { DrawToolbar } from '../components/drawing/DrawToolbar';
import { alertsHit, isAnalysisTrade, levelsAt, newDrawingId, type DrawKind, type Drawing, type Pt } from '../game/drawings';
import { AnimatePresence } from 'framer-motion';
import type { ChartType } from '../store';
import { roundEvents } from '../store';
import { eventWithin, fundamentalsAt, upcoming } from '../data/fundamentals';
import { FundamentalsPanel, FundamentalsSummary } from '../components/FundamentalsPanel';
import { autoLevels, detectPatterns, outcomeOf } from '../game/patterns';
import type { ClassicOverlay } from '../components/CandleChart';
import { isUnlocked, levelFrom, requiredLevel, type ToolId } from '../game/progression';
import { CoachTip } from '../components/CoachTip';
import { useFormingCandle } from './useFormingCandle';
import { Modal } from '../components/Modal';
import { NervesBar } from '../components/NervesBar';
import { NewsCard } from '../components/NewsCard';
import { TradeSheet } from '../components/TradeSheet';
import { ar } from '../i18n/ar';
import { currentAtr, roundCandles, useStore, type Speed } from '../store';
import { START_EQUITY, TOTAL_CANDLES, defaultStop, equityAt, pnlAt, triggerFor } from '../game/engine';
import { isLowNerves } from '../game/nerves';
import { fmtMoney, fmtPct, fmtPrice, fmtSignedMoney, fmtUnits } from '../format';
import { haptic, sfx } from '../fx';
import { canFullscreen, hasMouse, isBackKey, toggleFullscreen, useScreenFocus, useWide } from '../device';
import { ToolsSheet } from '../components/ToolsSheet';
import type { Side } from '../game/types';

const GAP_MS = 180; // pause between auto-played candles at 1x
const SPEEDS: Speed[] = [1, 2, 4];

export function Game() {
  const r = useStore((s) => s.round);
  const news = useStore((s) => s.activeNews);
  const pauseOpen = useStore((s) => s.pauseOpen);
  const defaultSpeed = useStore((s) => s.settings.speed);
  const motionOn = useStore((s) => s.settings.candleMotion);
  const level = useStore((s) => levelFrom(s.history));
  const unlockAll = useStore((s) => s.settings.unlockAll);
  const has = (t: ToolId) => isUnlocked(t, level, unlockAll);
  const indicatorsSet = useStore((s) => s.settings.indicators);
  const indicators = has('chart') ? indicatorsSet : [];
  const drawingsAll = useStore((s) => s.drawings);
  const drawings = has('drawing') ? drawingsAll : [];
  const magnet = useStore((s) => s.settings.magnet);
  const timeframeSet = useStore((s) => s.settings.timeframe);
  const chartTypeSet = useStore((s) => s.settings.chartType);
  // locked chart tools: daily candles only
  const timeframe = has('chart') ? timeframeSet : 'D';
  const chartType = has('chart') ? chartTypeSet : 'candles';
  const classicOn = useStore((s) => s.settings.classic) && has('classic');
  const store = useStore.getState();

  const [side, setSide] = useState<Side | null>(null);
  const [auto, setAuto] = useState(false);
  const [speed, setSpeed] = useState<Speed>(defaultSpeed);
  const [confirm, setConfirm] = useState<null | 'exit' | 'restart'>(null);
  const [indOpen, setIndOpen] = useState(false);
  const [drawOpen, setDrawOpen] = useState(false);
  const [tool, setTool] = useState<DrawKind | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [textAt, setTextAt] = useState<Pt | null>(null);
  const [text, setText] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [fundOpen, setFundOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [focus, setFocus] = useState(false);
  // full-screen chart; on browsers that allow it, also hide the browser's own bars
  const toggleFocus = () => {
    const next = !focus;
    setFocus(next);
    const fs = !!(document.fullscreenElement || (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement);
    if (next !== fs && canFullscreen()) toggleFullscreen();
  };
  const notice = useStore((s) => s.notice);
  useEffect(() => {
    if (!notice) return;
    setToast(notice);
    useStore.getState().clearNotice();
  }, [notice]);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);
  const shake = useAnimationControls();
  const wide = useWide();
  const rootRef = useScreenFocus<HTMLDivElement>();
  const showHints = useMemo(hasMouse, []);

  // Keyboard / TV remote. One listener; it calls the latest handler via a ref.
  const keyHandler = useRef<(e: KeyboardEvent, down: boolean) => void>(() => {});
  useEffect(() => {
    const kd = (e: KeyboardEvent) => keyHandler.current(e, true);
    const ku = (e: KeyboardEvent) => keyHandler.current(e, false);
    addEventListener('keydown', kd);
    addEventListener('keyup', ku);
    return () => { removeEventListener('keydown', kd); removeEventListener('keyup', ku); };
  }, []);
  const holdKey = useRef<{ code: string; timer: number } | null>(null);

  // Only redirect when we're actually the current screen (not while animating out to 'end').
  useEffect(() => { if (!r && useStore.getState().screen === 'game') store.go('menu'); }, [r, store]);

  const candles = r ? roundCandles(r) : [];
  const index = r?.index ?? 0;

  const blocked = !!news || pauseOpen || !!side || !!confirm || indOpen || !!textAt || confirmClear || fundOpen || toolsOpen;
  const low = r ? isLowNerves(r.nerves) : false;
  const { partial, forming, start, finish } = useFormingCandle(r, speed, motionOn, blocked);

  // the forming candle is drawn after the committed ones
  const visible = useMemo(
    () => (partial ? [...candles.slice(0, index + 1), partial] : candles.slice(0, index + 1)),
    [candles, index, partial],
  );

  // auto-play: start the next candle shortly after the previous one closes
  useEffect(() => {
    if (!auto || blocked || forming || r?.status !== 'playing') return;
    const t = window.setTimeout(start, GAP_MS / speed);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, blocked, forming, speed, index]);
  useEffect(() => { if (news) { setAuto(false); sfx.news(); haptic(30); } }, [news]);

  // per-candle feedback
  useEffect(() => {
    if (!r) return;
    sfx.tick();
    if (isLowNerves(r.nerves)) shake.start({ x: [0, -5, 5, -3, 3, 0], transition: { duration: 0.3 } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Classical analysis on closed candles only (the forming candle can't complete a pattern yet).
  const classic = useMemo<ClassicOverlay | null>(() => {
    if (!classicOn || !r) return null;
    const closed = candles.slice(0, index + 1);
    const patterns = detectPatterns(closed);
    const active = [...patterns].reverse().find((p) => p.confirmAt >= index - 30 && outcomeOf(p, closed) === 'open') ?? null;
    return { levels: autoLevels(closed), patterns, active, names: ar.classic.names };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classicOn, candles, index]);
  // announce a pattern on the candle that completes it
  useEffect(() => {
    const p = classic?.patterns.find((x) => x.confirmAt === index);
    if (p) setToast(ar.classic.confirmed(ar.classic.names[p.kind], p.dir === 'up', fmtPrice(p.target)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Price alerts on horizontal lines: stop auto-play when price touches one.
  const alertKey = partial ? `${index + 1}:${partial.high}:${partial.low}` : `${index}`;
  useEffect(() => {
    if (!r) return;
    const st = useStore.getState();
    const check = (c: { high: number; low: number }, ci: number) => {
      const hits = alertsHit(st.drawings, c, ci);
      if (!hits.length) return;
      for (const d of hits) st.updateDrawing({ ...d, alert: false, fired: true } as Drawing);
      setAuto(false);
      setToast(ar.draw.alertHit(fmtPrice(hits[0].a.p)));
      sfx.news();
      haptic(40);
    };
    if (partial) check(partial, index + 1);
    else check(candles[index], index); // also covers "candle motion off" and skipped animations
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertKey]);

  const tradeCount = r?.trades.length ?? 0;
  const prevTrades = useRef(tradeCount);
  useEffect(() => {
    if (r && tradeCount > prevTrades.current) {
      const last = r.trades[tradeCount - 1];
      if (last.pnl >= 0) sfx.win(); else sfx.loss();
      haptic(last.pnl >= 0 ? 20 : 40);
    }
    prevTrades.current = tradeCount;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradeCount]);

  if (!r) return null;

  const price = candles[index].close; // last closed candle: entries and stop checks use this
  const atr = currentAtr(r);
  // fundamentals as of the last closed candle
  const fund = fundamentalsAt(r.scenarioId, candles, index);
  const fundBefore = fundamentalsAt(r.scenarioId, candles, Math.max(0, index - 20));
  const events = roundEvents(r);
  const nextEvents = upcoming(events, index, 15);
  const eventSoon = eventWithin(events, index, 3);
  const lastEarnings = [...events].reverse().find((e) => e.kind === 'earnings' && e.at <= index) ?? null;
  const pos = r.position;
  // while a candle forms, P/L follows the live tick; once a level is touched it locks to the fill
  const hit = pos && partial ? triggerFor(pos, partial) : null;
  const livePrice = hit ? hit.price : partial ? partial.close : price;
  const equity = equityAt(r, livePrice);
  const changePct = ((equity - START_EQUITY) / START_EQUITY) * 100;
  const up = changePct >= 0;
  const pnl = pos ? pnlAt(pos, livePrice) : 0;
  const holdMs = low ? 1000 : undefined;
  const canTrade = !pos && r.status === 'playing' && !forming;

  const step = () => {
    if (blocked) return;
    if (forming) finish();
    else start();
  };

  const toggleTimeframe = () => store.setSettings({ timeframe: timeframe === 'D' ? 'W' : 'D' });
  const cycleChartType = () => {
    const order: ChartType[] = ['candles', 'ha', 'line'];
    const next = order[(order.indexOf(chartType) + 1) % order.length];
    store.setSettings({ chartType: next });
    if (next === 'ha') setToast(ar.chart.haNote);
  };
  // trade "based on analysis": near a level drawn on an earlier candle, stop beyond it
  const analysisFor = (sd: Side, stop: number | null) =>
    isAnalysisTrade(levelsAt(drawings, index), sd, price, stop, atr);

  const openTrade = (s: Side) => {
    if (!canTrade || (s === 'short' && r.mode === 'sharia')) return;
    setSide(s);
  };

  // Shortcuts use e.code (physical key) so they work with an Arabic keyboard layout too.
  keyHandler.current = (e, down) => {
    if (e.defaultPrevented) return; // a dialog already handled it
    const t = e.target as HTMLElement;
    if (t.tagName === 'INPUT') return;

    // B / S under low nerves need the same 1-second hold as the buttons
    if (!down) {
      if (holdKey.current?.code === e.code) { window.clearTimeout(holdKey.current.timer); holdKey.current = null; }
      return;
    }
    if (isBackKey(e)) {
      e.preventDefault();
      // back first leaves drawing modes, then opens/closes the pause sheet
      if (tool) setTool(null);
      else if (selected) setSelected(null);
      else if (focus) toggleFocus();
      else store.setPause(!pauseOpen);
      return;
    }
    if ((e.code === 'Delete' || e.code === 'Backspace') && selected) {
      e.preventDefault();
      store.removeDrawing(selected);
      setSelected(null);
      return;
    }
    if (blocked || e.metaKey || e.ctrlKey || e.altKey) return;
    const onButton = t.tagName === 'BUTTON';
    const trade = (sd: Side) => {
      if (e.repeat) return;
      if (!holdMs) return openTrade(sd);
      holdKey.current = { code: e.code, timer: window.setTimeout(() => { holdKey.current = null; openTrade(sd); }, holdMs) };
    };
    switch (e.code) {
      case 'Space': case 'KeyN':
        if (onButton && e.code === 'Space') return; // Space on a focused button presses that button
        e.preventDefault();
        if (!e.repeat) { if (auto) { setAuto(false); finish(); } else step(); }
        break;
      case 'KeyA': if (!e.repeat) setAuto((a) => !a); break;
      case 'KeyB': trade('long'); break;
      case 'KeyS': trade('short'); break;
      case 'KeyC': if (pos) store.close(); break;
      case 'KeyI': if (has('chart')) setIndOpen(true); break;
      case 'KeyD': if (has('drawing')) { setDrawOpen((o) => !o); if (drawOpen) setTool(null); } break;
      case 'KeyW': if (has('chart')) toggleTimeframe(); break;
      case 'KeyG': if (has('fundamentals')) setFundOpen(true); break;
      case 'KeyK': if (has('classic')) store.setSettings({ classic: !useStore.getState().settings.classic }); break;
      case 'KeyT': if (has('chart')) cycleChartType(); break;
      case 'KeyF': toggleFocus(); break;
      case 'Digit1': setSpeed(1); break;
      case 'Digit2': setSpeed(2); break;
      case 'Digit4': setSpeed(4); break;
    }
  };

  // one slim header line: pause · equity and change · candle counter
  const topBar = (
    <div className={`flex items-center gap-2 ${wide && !focus ? 'rounded-xl border border-border bg-surface p-2 short:p-1' : 'safe-top px-2 pb-0.5'}`}>
      <Button size="icon" variant="secondary" ariaLabel={ar.pauseLabel} onClick={() => store.setPause(true)}>
        <span className="text-base">❚❚</span>
      </Button>
      <div className="flex flex-1 items-baseline justify-center gap-2">
        <span className="num text-2xl font-bold leading-tight short:text-xl">{fmtMoney(equity)}</span>
        <span className={`num text-sm font-semibold ${up ? 'text-up' : 'text-down'}`}>{up ? '▲' : '▼'} {fmtPct(changePct, 2)}</span>
      </div>
      <div className="min-w-[2.75rem] text-center text-xs text-muted">
        <span className="num">{index + 1}/{TOTAL_CANDLES}</span>
      </div>
    </div>
  );

  const drawBar = drawOpen && has('drawing') && (
    <div className={wide && !focus ? '' : 'mx-2'}>
      <DrawToolbar
        tool={tool} onTool={(t) => { setTool(t); setSelected(null); }}
        magnet={magnet} onMagnet={(m) => store.setSettings({ magnet: m })}
        count={drawings.length} onClear={() => setConfirmClear(true)}
      />
    </div>
  );

  const coach = <CoachTip hasPosition={!!pos} tradesDone={r.trades.length} candlesSeen={index - 59} className={wide && !focus ? '' : 'mx-2 mb-1'} />;

  // the chart takes all the room there is; tools and full-screen sit on top of it
  const chartBox = (
    <div className={`relative min-h-[12rem] flex-1 overflow-hidden rounded-xl border border-border bg-surface ${wide && !focus ? '' : 'mx-1'}`}>
          <CandleChart
            candles={visible}
            dataKey={`${r.scenarioId}:${r.seed}:${r.startedAt}`}
            position={pos}
            indicators={indicators}
            timeframe={timeframe}
            chartType={chartType}
            classic={classic}
            onStopCommit={(p) => store.moveStop(p)}
            drawing={{
              drawings, tool, magnet, selected,
              onSelect: setSelected,
              onAdd: (d) => store.addDrawing({ ...d, at: index }),
              onUpdate: store.updateDrawing,
              onDelete: store.removeDrawing,
              onToolDone: () => setTool(null),
              onTextAt: (pt) => { setText(''); setTextAt(pt); },
              onToggleAlert: (d) => {
                if (d.kind !== 'hline') return;
                // arm from the next candle so it can't fire on the candle you set it on
                store.updateDrawing({ ...d, alert: !d.alert, alertFrom: index + 1, fired: false });
              },
            }}
          />
      <div className="absolute bottom-8 left-2 z-20 flex gap-1.5">
        <button
          type="button" onClick={() => setToolsOpen(true)}
          className="flex h-9 items-center gap-1 rounded-full border border-border bg-surface-2/90 px-3 text-xs font-semibold shadow-lg backdrop-blur active:scale-95"
        >
          🧰 {ar.tools.button}
        </button>
        <button
          type="button" onClick={toggleFocus} aria-label={focus ? ar.tools.exitFocus : ar.tools.focus}
          className={`flex h-9 w-9 items-center justify-center rounded-full border shadow-lg active:scale-95 ${focus ? 'border-gold bg-gold text-bg' : 'border-border bg-surface-2/90'}`}
        >
          {focus ? '✕' : '⛶'}
        </button>
      </div>
    </div>
  );

  // open position in one line, only while a trade is open
  const positionStrip = pos && (
    <div className="mx-1 mt-1 flex items-center gap-2 rounded-xl border border-border bg-surface px-2 py-1.5 text-xs">
      <span className={`font-bold ${pos.side === 'long' ? 'text-up' : 'text-down'}`}>{pos.side === 'long' ? ar.game.long : ar.game.short}</span>
      {pos.reckless && <span className="rounded bg-down px-1.5 py-0.5 text-white">{ar.game.reckless}</span>}
      {hit && <span className={`rounded px-1.5 py-0.5 text-white ${hit.reason === 'stop' ? 'bg-down' : 'bg-up'}`}>{hit.reason === 'stop' ? ar.chart.stopHit : ar.chart.tpHit}</span>}
      <span className={`num text-sm font-bold ${pnl >= 0 ? 'text-up' : 'text-down'}`}>{pnl >= 0 ? '▲' : '▼'} {fmtSignedMoney(pnl)}</span>
      <span className="min-w-0 flex-1 truncate text-muted">{ar.game.stop} <span className="num text-down">{pos.stop != null ? fmtPrice(pos.stop) : ar.game.none}</span></span>
      {pos.stop == null && (
        <button type="button" onClick={() => store.moveStop(defaultStop(pos.side, price, atr))} className="h-8 rounded-lg bg-surface-2 px-2.5 font-semibold active:scale-95">{ar.game.addStop}</button>
      )}
      <button type="button" onClick={() => store.close()} className="h-8 rounded-lg bg-surface-2 px-2.5 font-semibold active:scale-95">{ar.game.close}</button>
    </div>
  );

  const positionCard = (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-sm short:py-1">
          {pos ? (
            <>
              <div className="flex items-center justify-between">
                <span className={`font-bold ${pos.side === 'long' ? 'text-up' : 'text-down'}`}>
                  {pos.side === 'long' ? ar.game.long : ar.game.short}
                  {pos.reckless && <span className="mr-2 rounded bg-down px-1.5 py-0.5 text-xs text-white">{ar.game.reckless}</span>}
                  {hit && (
                    <span className={`mr-2 rounded px-1.5 py-0.5 text-xs text-white ${hit.reason === 'stop' ? 'bg-down' : 'bg-up'}`}>
                      {hit.reason === 'stop' ? ar.chart.stopHit : ar.chart.tpHit}
                    </span>
                  )}
                </span>
                <span className={`num text-base font-bold ${pnl >= 0 ? 'text-up' : 'text-down'}`}>
                  {pnl >= 0 ? '▲' : '▼'} {fmtSignedMoney(pnl)}
                </span>
              </div>
              <div className="mt-1 grid grid-cols-4 gap-1 text-xs text-muted">
                <div>{ar.game.size}<div className="num text-text">{fmtUnits(pos.size)}</div></div>
                <div>{ar.game.entry}<div className="num text-text">{fmtPrice(pos.entry)}</div></div>
                <div>{ar.game.stop}<div className="num text-down">{pos.stop != null ? fmtPrice(pos.stop) : ar.game.none}</div></div>
                <div>{ar.game.risk}<div className="num text-text">{pos.reckless ? '∞' : `${pos.riskPct.toFixed(1)}%`}</div></div>
              </div>
              <div className="mt-2 flex gap-2">
                {pos.stop == null && (
                  <Button size="md" variant="secondary" className="h-10 flex-1 text-sm short:h-8"
                    onClick={() => store.moveStop(defaultStop(pos.side, price, atr))}>
                    {ar.game.addStop}
                  </Button>
                )}
                <Button size="md" variant="secondary" className="h-10 flex-1 text-sm short:h-8" onClick={() => store.close()}>
                  {ar.game.close}
                </Button>
              </div>
            </>
          ) : (
            <div className="py-1 text-center text-muted">{ar.game.noPosition}</div>
          )}
    </div>
  );

  const speedChip = auto && (
    <button
      type="button"
      onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
      className={`rounded-full border border-gold/50 bg-surface-2 px-3 py-1 text-sm font-semibold text-gold ${
        wide && !focus ? 'mx-auto mb-2 block' : 'absolute -top-9 left-1/2 -translate-x-1/2'}`}
    >
      {ar.game.auto} <span className="num">{speed}x</span>
    </button>
  );

  // RTL: شراء on the right, بيع on the left
  const actionBar = (
    <div className={wide && !focus ? '' : 'safe-bottom relative px-2 pt-2'}>
      {speedChip}
      <div className="flex gap-2">
        <Button variant="buy" className="flex-1 short:h-12" disabled={!canTrade} holdMs={holdMs} onClick={() => openTrade('long')}>
          ▲ {ar.game.buy}
        </Button>
        <Button
          variant="gold" className="flex-[1.4] text-xl short:h-12"
          onClick={() => { if (auto) { setAuto(false); finish(); } else step(); }}
          onLongPress={() => setAuto((a) => !a)}
        >
          {auto ? '❚❚' : `${ar.game.next} ◀`}
        </Button>
        <Button variant="sell" className="flex-1 short:h-12" disabled={!canTrade || r.mode === 'sharia'} holdMs={holdMs} onClick={() => openTrade('short')}>
          ▼ {ar.game.sell}
        </Button>
      </div>
    </div>
  );

  const column = (
    <>
      <motion.div animate={shake} className="flex min-h-0 flex-1 flex-col">
        {!focus && topBar}
        {focus && (
          // full-screen: one thin status line keeps the essentials in view
          <div className="safe-top flex items-center justify-center gap-3 px-2 pb-0.5 text-xs">
            <span className="num font-bold">{fmtMoney(equity)}</span>
            <span className={`num ${up ? 'text-up' : 'text-down'}`}>{up ? '▲' : '▼'} {fmtPct(changePct, 1)}</span>
            <span className="text-muted">{ar.game.nerves} <span className="num text-text">{Math.round(r.nerves)}</span></span>
            <span className="num text-muted">{index + 1}/{TOTAL_CANDLES}</span>
          </div>
        )}
        {!focus && <NervesBar compact value={r.nerves} log={r.nervesLog} />}
        {drawBar}
        {!focus && coach}
        {chartBox}
        {positionStrip}
      </motion.div>
      {actionBar}
    </>
  );

  return (
    <motion.div
      ref={rootRef}
      className="absolute inset-0 flex flex-col"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
    >
      {wide && !focus ? (
        // tablets in landscape, laptops, TVs, phones on their side: controls on the right, chart fills the rest
        <motion.div animate={shake} className="safe-x flex min-h-0 flex-1 gap-3 p-3 short:gap-2 short:p-2">
          <aside className="flex w-[21rem] shrink-0 flex-col gap-3 overflow-y-auto short:w-[17rem] short:gap-2">
            {topBar}
            <div className="rounded-xl border border-border bg-surface py-1 short:py-0">
              <NervesBar value={r.nerves} log={r.nervesLog} />
            </div>
            {positionCard}
            <div className={has('fundamentals') ? 'short:hidden' : 'hidden'}>
              <FundamentalsSummary card f={fund} next={nextEvents[0] ?? null} index={index} onOpen={() => setFundOpen(true)} />
            </div>
            <div className="flex-1" />
            {coach}
            {showHints && <p className="text-center text-xs leading-relaxed text-muted short:hidden">{ar.shortcuts}</p>}
            {actionBar}
          </aside>
          <section className="flex min-w-0 flex-1 flex-col">
            {drawBar}
            {chartBox}
          </section>
        </motion.div>
      ) : column}

      {/* low-nerves vignette */}
      {low && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-30"
          initial={{ opacity: 0 }} animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 2, repeat: Infinity }}
          style={{ background: 'radial-gradient(ellipse at center, transparent 45%, rgba(234,57,67,0.25) 100%)', boxShadow: 'inset 0 0 80px rgba(234,57,67,0.25)' }}
        />
      )}

      <TradeSheet
        side={side} round={r} price={price} atr={atr} holdMs={holdMs}
        onClose={() => setSide(null)}
        analysisFor={analysisFor}
        eventSoon={has('fundamentals') && eventSoon}
        onConfirm={(p) => {
          store.open({ ...p, analysis: analysisFor(p.side, p.stop), pe: fund.pe, eventSoon });
          sfx.open();
          setSide(null);
        }}
      />

      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            className="pointer-events-none fixed left-1/2 top-20 z-40 max-w-[90vw] -translate-x-1/2 rounded-full border border-gold/50 bg-surface-2 px-4 py-2 text-center text-sm font-semibold text-gold shadow-lg"
            initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <NewsCard text={news} onDismiss={() => store.dismissNews()} />

      <BottomSheet open={!!textAt} onClose={() => setTextAt(null)} title={ar.draw.textPrompt}>
        <div className="space-y-3 pb-2">
          <input
            autoFocus value={text} onChange={(e) => setText(e.target.value)} maxLength={40}
            onKeyDown={(e) => { if (e.key === 'Enter' && text.trim() && textAt) { e.preventDefault(); store.addDrawing({ id: newDrawingId(), kind: 'text', a: textAt, text: text.trim(), at: index }); setTextAt(null); } }}
            className="h-12 w-full rounded-xl border border-border bg-surface-2 px-3 text-lg outline-none focus:border-gold"
          />
          <div className="flex gap-3">
            <Button variant="gold" className="flex-[2]" disabled={!text.trim()}
              onClick={() => { if (textAt) store.addDrawing({ id: newDrawingId(), kind: 'text', a: textAt, text: text.trim(), at: index }); setTextAt(null); }}>
              {ar.draw.save}
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => setTextAt(null)}>{ar.draw.cancel}</Button>
          </div>
        </div>
      </BottomSheet>

      <Modal
        open={confirmClear} message={ar.draw.clearConfirm} confirm={ar.draw.clearYes} cancel={ar.draw.cancel} danger
        onConfirm={() => { store.clearDrawings(); setSelected(null); setConfirmClear(false); }}
        onCancel={() => setConfirmClear(false)}
      />

      <BottomSheet open={fundOpen} onClose={() => setFundOpen(false)} title={`📊 ${ar.fund.title}`}>
        <FundamentalsPanel f={fund} before={fundBefore} upcoming={nextEvents} index={index} lastEarnings={lastEarnings} />
      </BottomSheet>

      <ToolsSheet
        open={toolsOpen} onClose={() => setToolsOpen(false)} has={has}
        indicators={indicators} drawOpen={drawOpen} drawCount={drawings.length}
        timeframe={timeframe} chartType={chartType} classicOn={classicOn}
        fundSummary={`${fund.pe !== null ? `${ar.fund.pe} ${fund.pe.toFixed(0)} · ` : ''}${ar.fund.mood[fund.mood]}`}
        onIndicators={() => { setToolsOpen(false); setIndOpen(true); }}
        onDraw={() => { setToolsOpen(false); setDrawOpen((o) => !o); setTool(null); setSelected(null); }}
        onTimeframe={toggleTimeframe}
        onChartType={cycleChartType}
        onClassic={() => store.setSettings({ classic: !useStore.getState().settings.classic })}
        onFundamentals={() => { setToolsOpen(false); setFundOpen(true); }}
        onLocked={(t) => setToast(`${ar.progress.tools[t].name}: ${ar.progress.locked(requiredLevel(t))}`)}
      />

      <IndicatorSheet open={indOpen} active={indicators} onToggle={store.toggleIndicator} onClose={() => setIndOpen(false)} />

      <BottomSheet open={pauseOpen} onClose={() => store.setPause(false)} title={ar.pause.title}>
        <div className="flex flex-col gap-3 pb-2">
          <Button variant="gold" onClick={() => store.setPause(false)}>{ar.pause.resume}</Button>
          <Button variant="secondary" onClick={() => setConfirm('restart')}>{ar.pause.restart}</Button>
          <Button variant="secondary" onClick={() => store.openSettings('game')}>{ar.pause.settings}</Button>
          <Button variant="secondary" onClick={() => setConfirm('exit')}>{ar.pause.exit}</Button>
        </div>
      </BottomSheet>

      <Modal
        open={confirm === 'exit'}
        message={ar.pause.exitConfirm}
        confirm={ar.pause.exitYes}
        cancel={ar.pause.exitNo}
        onConfirm={() => { setConfirm(null); store.setPause(false); store.go('menu'); }}
        onCancel={() => setConfirm(null)}
      />
      <Modal
        open={confirm === 'restart'}
        message={ar.pause.restartConfirm}
        confirm={ar.pause.restartYes}
        cancel={ar.pause.exitNo}
        danger
        onConfirm={() => { setConfirm(null); setAuto(false); store.restartRound(); }}
        onCancel={() => setConfirm(null)}
      />
    </motion.div>
  );
}
