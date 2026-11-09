import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  applyCandle, atr, closeTrade, moveStop as engineMoveStop, newRound, openTrade,
} from './game/engine';
import { computeStats, type Grade, type RoundStats } from './game/scoring';
import { lessonsFor } from './game/lessons';
import type { Candle, Mode, OpenParams, RoundState } from './game/types';
import type { Drawing } from './game/drawings';
import { DEFAULT_INDICATORS, MAX_INDICATORS, type IndicatorId } from './components/indicatorDefs';
import {
  CURRENT_GEN, SCENARIOS, dailyChallenge, generateCandles, getScenario, newsAt, registerCustomScenario, unregisterCustomScenario,
} from './data/scenarios';
import { isCustomId, toScenario, type CustomMarket } from './game/customMarket';
import { scheduledEvents, type ScheduledEvent } from './data/fundamentals';
import { describeEvent, type NewsItem } from './game/eventText';
import { detectPatterns, outcomeOf, type Outcome, type PatternKind } from './game/patterns';
import { HISTORY_CANDLES } from './game/engine';

export type Screen =
  | 'splash' | 'tutorial' | 'menu' | 'mode' | 'briefing' | 'game' | 'end' | 'history' | 'settings' | 'builder';

export type Speed = 1 | 2 | 4;

export interface Settings {
  sound: boolean;
  haptics: boolean;
  speed: Speed;
  candleMotion: boolean;
  indicators: IndicatorId[];
  magnet: boolean;
  timeframe: Timeframe;
  chartType: ChartType;
  classic: boolean; // auto support/resistance + pattern recognition
}

export type Timeframe = 'D' | 'W';
export type ChartType = 'candles' | 'ha' | 'line';

export interface HistoryEntry {
  id: string;
  scenarioId: number;
  name?: string; // market name at the time (player-designed markets can be deleted later)
  mode: Mode;
  daily: boolean;
  survived: boolean;
  grade: Grade;
  returnPct: number;
  maxDrawdownPct: number;
  discipline: number;
  trades: number;
  date: number;
}

export interface PatternReview {
  kind: PatternKind;
  dir: 'up' | 'down';
  confirmAt: number;
  outcome: Outcome;
  traded: boolean; // a trade in its direction opened within 5 candles of completion
}

export interface RoundResult {
  round: RoundState;
  stats: RoundStats;
  lessons: string[];
  unlockedNew: boolean;
  patterns?: PatternReview[];
}

/** Classical patterns that completed during play (not in the history part), with what happened next. */
export function reviewPatterns(r: RoundState): PatternReview[] {
  const played = roundCandles(r).slice(0, r.index + 1);
  return detectPatterns(played)
    .filter((p) => p.confirmAt >= HISTORY_CANDLES)
    .map((p) => ({
      kind: p.kind,
      dir: p.dir,
      confirmAt: p.confirmAt,
      outcome: outcomeOf(p, played),
      traded: r.trades.some((t) => t.openedAt >= p.confirmAt && t.openedAt <= p.confirmAt + 5 && (t.side === 'long') === (p.dir === 'up'))
        || (!!r.position && r.position.openedAt >= p.confirmAt && r.position.openedAt <= p.confirmAt + 5 && (r.position.side === 'long') === (p.dir === 'up')),
    }));
}

export interface Pending {
  mode: Mode;
  scenarioId: number;
  seed: number;
  daily: boolean;
  gen?: number;
}

interface State {
  // navigation (not persisted)
  screen: Screen;
  settingsBack: Screen;
  pauseOpen: boolean;
  pending: Pending | null;
  dailyFlow: boolean; // mode-select was opened from "daily challenge"

  // persisted
  settings: Settings;
  tutorialSeen: boolean;
  unlocked: number; // highest unlocked scenario id
  survivedIds: number[];
  history: HistoryEntry[];
  round: RoundState | null;
  drawings: Drawing[]; // drawings of the current round
  /** blocking card: scripted news (string) or a released scheduled event */
  activeNews: string | NewsItem | null;
  /** short non-blocking message (e.g. inflation release), shown as a toast */
  notice: string | null;
  dailyDone: string | null;
  lastResult: RoundResult | null;
  customs: CustomMarket[]; // player-designed markets
  editing: number | null; // custom market open in the designer (null = new)
  modePick: Mode | null; // mode chosen on the mode screen (kept while visiting the designer)
  setModePick: (m: Mode | null) => void;

  go: (s: Screen) => void;
  openBuilder: (id: number | null) => void;
  saveCustom: (m: CustomMarket) => void;
  deleteCustom: (id: number) => void;
  beginFlow: (daily: boolean) => void;
  back: () => void;
  openSettings: (from: Screen) => void;
  setPause: (open: boolean) => void;
  setSettings: (p: Partial<Settings>) => void;
  toggleIndicator: (id: IndicatorId) => void;
  finishTutorial: () => void;
  replayTutorial: () => void;

  prepare: (p: { mode: Mode; scenarioId?: number; daily?: boolean }) => void;
  startRound: () => void;
  restartRound: () => void;
  next: () => void;
  open: (p: OpenParams) => void;
  close: () => void;
  moveStop: (price: number) => void;
  dismissNews: () => void;
  clearNotice: () => void;
  addDrawing: (d: Drawing) => void;
  updateDrawing: (d: Drawing) => void;
  removeDrawing: (id: string) => void;
  clearDrawings: () => void;
  resetProgress: () => void;
}

const cache = new Map<string, Candle[]>();
export function candlesFor(scenarioId: number, seed: number, gen = 1): Candle[] {
  const key = `${scenarioId}:${seed}:${gen}`;
  let c = cache.get(key);
  if (!c) {
    c = generateCandles(getScenario(scenarioId), seed, gen);
    cache.set(key, c);
  }
  return c;
}

export const roundCandles = (r: RoundState) => candlesFor(r.scenarioId, r.seed, r.gen ?? 1);

const evCache = new Map<string, ScheduledEvent[]>();
/** Scheduled events (earnings, rate decisions, inflation) of a round. */
export function roundEvents(r: RoundState): ScheduledEvent[] {
  const key = `${r.scenarioId}:${r.seed}:${r.gen ?? 1}`;
  let e = evCache.get(key);
  if (!e) {
    e = scheduledEvents(r.scenarioId, roundCandles(r));
    evCache.set(key, e);
  }
  return e;
}
export const currentPrice = (r: RoundState) => roundCandles(r)[r.index].close;
export const currentAtr = (r: RoundState) => atr(roundCandles(r), r.index);

/**
 * Screen to show after a reload: where the player was, unless the data that
 * screen needs is gone (then fall back to the menu). Splash never persists.
 */
export function restoreScreen(p: {
  screen?: Screen; round: RoundState | null; lastResult: RoundResult | null; pending: Pending | null;
}): Screen | undefined {
  const sc = p.screen;
  if (!sc || sc === 'splash') return undefined;
  if (sc === 'game' && !p.round) return 'menu';
  if (sc === 'end' && !p.lastResult) return 'menu';
  if (sc === 'briefing' && !p.pending) return 'menu';
  return sc;
}

const randomSeed = () => Math.floor(Math.random() * 2 ** 31);

const defaults = {
  settings: { sound: true, haptics: true, speed: 1 as Speed, candleMotion: true, indicators: DEFAULT_INDICATORS, magnet: true, timeframe: 'D' as Timeframe, chartType: 'candles' as ChartType, classic: true },
  tutorialSeen: false,
  unlocked: 1,
  survivedIds: [] as number[],
  history: [] as HistoryEntry[],
  round: null,
  drawings: [] as Drawing[],
  activeNews: null,
  notice: null,
  dailyDone: null,
  lastResult: null,
  customs: [] as CustomMarket[],
};

export const useStore = create<State>()(
  persist(
    (set, get) => {
      const finish = (r: RoundState) => {
        const stats = computeStats(r);
        const patterns = reviewPatterns(r);
        const lessons = lessonsFor(stats, r.trades.filter((t) => t.reckless).length, patterns.filter((p) => p.traded).length);
        const survived = r.status === 'survived';
        const s = get();
        const canUnlock = survived && !r.daily && r.scenarioId === s.unlocked && s.unlocked < SCENARIOS.length;
        const entry: HistoryEntry = {
          id: `${r.startedAt}`,
          scenarioId: r.scenarioId,
          name: getScenario(r.scenarioId).name,
          mode: r.mode,
          daily: r.daily,
          survived,
          grade: stats.grade,
          returnPct: stats.returnPct,
          maxDrawdownPct: stats.maxDrawdownPct,
          discipline: stats.discipline,
          trades: stats.trades,
          date: Date.now(),
        };
        set({
          round: null,
          drawings: [],
          activeNews: null,
          pauseOpen: false,
          history: [entry, ...s.history].slice(0, 100),
          unlocked: canUnlock ? s.unlocked + 1 : s.unlocked,
          survivedIds: survived && !s.survivedIds.includes(r.scenarioId) && !r.daily && !isCustomId(r.scenarioId)
            ? [...s.survivedIds, r.scenarioId] : s.survivedIds,
          dailyDone: r.daily ? dailyChallenge().key : s.dailyDone,
          lastResult: { round: r, stats, lessons, unlockedNew: canUnlock, patterns },
          pending: { mode: r.mode, scenarioId: r.scenarioId, seed: r.seed, daily: r.daily, gen: CURRENT_GEN },
          screen: 'end',
        });
      };

      return {
        ...defaults,
        screen: 'splash',
        settingsBack: 'menu',
        pauseOpen: false,
        pending: null,
        dailyFlow: false,

        go: (screen) => set({ screen }),
        editing: null,
        modePick: null,
        setModePick: (modePick) => set({ modePick }),
        openBuilder: (editing) => set({ editing, screen: 'builder' }),
        saveCustom: (m) => {
          registerCustomScenario(toScenario(m));
          // a changed design must not reuse candles cached for the old one
          for (const k of [...cache.keys()]) if (k.startsWith(`${m.id}:`)) cache.delete(k);
          for (const k of [...evCache.keys()]) if (k.startsWith(`${m.id}:`)) evCache.delete(k);
          const others = get().customs.filter((x) => x.id !== m.id);
          set({ customs: [m, ...others] });
        },
        deleteCustom: (id) => {
          unregisterCustomScenario(id);
          const s = get();
          // a saved round on that market can't be rebuilt any more
          set({ customs: s.customs.filter((x) => x.id !== id), round: s.round?.scenarioId === id ? null : s.round });
        },
        beginFlow: (dailyFlow) => set({ dailyFlow, modePick: null, screen: 'mode' }),
        back: () => {
          const { screen, settingsBack, pauseOpen } = get();
          if (screen === 'game') set({ pauseOpen: !pauseOpen });
          else if (screen === 'settings') set({ screen: settingsBack, pauseOpen: settingsBack === 'game' });
          else if (screen === 'briefing') set({ screen: 'mode' });
          else if (screen === 'builder') set({ screen: 'mode' });
          else if (screen !== 'menu' && screen !== 'splash') set({ screen: 'menu' });
        },
        openSettings: (from) => set({ settingsBack: from, screen: 'settings', pauseOpen: false }),
        setPause: (pauseOpen) => set({ pauseOpen }),
        setSettings: (p) => set({ settings: { ...get().settings, ...p } }),
        toggleIndicator: (id) => {
          const cur = get().settings.indicators;
          if (cur.includes(id)) set({ settings: { ...get().settings, indicators: cur.filter((x) => x !== id) } });
          else if (cur.length < MAX_INDICATORS) set({ settings: { ...get().settings, indicators: [...cur, id] } });
        },
        finishTutorial: () => set({ tutorialSeen: true, screen: 'menu' }),
        replayTutorial: () => set({ screen: 'tutorial' }),

        prepare: ({ mode, scenarioId, daily }) => {
          if (daily) {
            const d = dailyChallenge();
            set({ pending: { mode, scenarioId: d.scenarioId, seed: d.seed, daily: true, gen: CURRENT_GEN }, screen: 'briefing' });
          } else {
            set({ pending: { mode, scenarioId: scenarioId ?? 1, seed: randomSeed(), daily: false, gen: CURRENT_GEN }, screen: 'briefing' });
          }
        },
        startRound: () => {
          const p = get().pending;
          if (!p) return;
          set({ round: newRound(p), drawings: [], activeNews: null, pauseOpen: false, screen: 'game' });
        },
        restartRound: () => {
          const r = get().round;
          if (!r) return;
          // daily keeps its seed; normal rounds get a fresh one
          const seed = r.daily ? r.seed : randomSeed();
          set({ round: newRound({ scenarioId: r.scenarioId, mode: r.mode, daily: r.daily, seed, gen: CURRENT_GEN }), drawings: [], activeNews: null, pauseOpen: false });
        },
        next: () => {
          const { round: r, activeNews } = get();
          if (!r || r.status !== 'playing' || activeNews) return;
          const candles = roundCandles(r);
          let n = applyCandle(r, candles[r.index + 1]);
          const news = newsAt(n.scenarioId, n.index);
          let shown: string | NewsItem | null = null;
          let notice: string | null = null;
          if (news && !n.newsSeen.includes(news.at)) {
            n = { ...n, newsSeen: [...n.newsSeen, news.at] };
            shown = news.text;
          }
          // scheduled releases after this candle closes
          for (const e of roundEvents(n)) {
            if (e.at !== n.index || n.eventsSeen?.includes(e.id)) continue;
            n = { ...n, eventsSeen: [...(n.eventsSeen ?? []), e.id] };
            if (e.viaNews) continue; // the news card already announces it
            const item = describeEvent(e);
            if (e.blocking && !shown) shown = item;
            else notice = `${item.title}: ${item.text}`;
          }
          if (n.status !== 'playing') return finish(n);
          set({ round: n, activeNews: shown, notice });
        },
        open: (p) => {
          const r = get().round;
          if (!r) return;
          set({ round: openTrade(r, p, currentPrice(r), currentAtr(r)) });
        },
        close: () => {
          const r = get().round;
          if (!r?.position) return;
          set({ round: closeTrade(r, currentPrice(r), 'manual') });
        },
        moveStop: (price) => {
          const r = get().round;
          if (!r) return;
          set({ round: engineMoveStop(r, price, currentPrice(r)) });
        },
        dismissNews: () => set({ activeNews: null }),
        clearNotice: () => set({ notice: null }),
        addDrawing: (d) => set({ drawings: [...get().drawings, d] }),
        updateDrawing: (d) => set({ drawings: get().drawings.map((x) => (x.id === d.id ? d : x)) }),
        removeDrawing: (id) => set({ drawings: get().drawings.filter((x) => x.id !== id) }),
        clearDrawings: () => set({ drawings: [] }),
        resetProgress: () => set({ ...defaults, tutorialSeen: true, settings: get().settings, screen: 'menu' }),
      };
    },
    {
      name: 'last-candle',
      version: 1,
      partialize: (s) => ({
        // where the player is, so a refresh lands back on the same screen
        screen: s.screen === 'splash' ? undefined : s.screen,
        settingsBack: s.settingsBack,
        pending: s.pending,
        dailyFlow: s.dailyFlow,
        settings: s.settings,
        tutorialSeen: s.tutorialSeen,
        unlocked: s.unlocked,
        survivedIds: s.survivedIds,
        history: s.history,
        round: s.round,
        drawings: s.drawings,
        activeNews: s.activeNews,
        dailyDone: s.dailyDone,
        lastResult: s.lastResult,
        customs: s.customs,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        // settings merge per-key so new settings get defaults on old saves
        const merged = { ...current, ...p, settings: { ...current.settings, ...(p.settings ?? {}) } };
        // player-designed markets must be known before any saved round is rebuilt
        for (const m of merged.customs ?? []) registerCustomScenario(toScenario(m));
        const screen = restoreScreen({
          screen: p.screen,
          round: merged.round,
          lastResult: merged.lastResult,
          pending: merged.pending,
        });
        return { ...merged, screen: screen ?? current.screen };
      },
    },
  ),
);
