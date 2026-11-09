import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  applyCandle, atr, closeTrade, moveStop as engineMoveStop, newRound, openTrade,
} from './game/engine';
import { computeStats, type Grade, type RoundStats } from './game/scoring';
import { lessonsFor } from './game/lessons';
import type { Candle, Mode, OpenParams, RoundState } from './game/types';
import { DEFAULT_INDICATORS, MAX_INDICATORS, type IndicatorId } from './components/indicatorDefs';
import { SCENARIOS, dailyChallenge, generateCandles, getScenario, newsAt } from './data/scenarios';

export type Screen =
  | 'splash' | 'tutorial' | 'menu' | 'mode' | 'briefing' | 'game' | 'end' | 'history' | 'settings';

export type Speed = 1 | 2 | 4;

export interface Settings {
  sound: boolean;
  haptics: boolean;
  speed: Speed;
  candleMotion: boolean;
  indicators: IndicatorId[];
}

export interface HistoryEntry {
  id: string;
  scenarioId: number;
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

export interface RoundResult {
  round: RoundState;
  stats: RoundStats;
  lessons: string[];
  unlockedNew: boolean;
}

export interface Pending {
  mode: Mode;
  scenarioId: number;
  seed: number;
  daily: boolean;
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
  activeNews: string | null;
  dailyDone: string | null;
  lastResult: RoundResult | null;

  go: (s: Screen) => void;
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
  resetProgress: () => void;
}

const cache = new Map<string, Candle[]>();
export function candlesFor(scenarioId: number, seed: number): Candle[] {
  const key = `${scenarioId}:${seed}`;
  let c = cache.get(key);
  if (!c) {
    c = generateCandles(getScenario(scenarioId), seed);
    cache.set(key, c);
  }
  return c;
}

export const roundCandles = (r: RoundState) => candlesFor(r.scenarioId, r.seed);
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
  settings: { sound: true, haptics: true, speed: 1 as Speed, candleMotion: true, indicators: DEFAULT_INDICATORS },
  tutorialSeen: false,
  unlocked: 1,
  survivedIds: [] as number[],
  history: [] as HistoryEntry[],
  round: null,
  activeNews: null,
  dailyDone: null,
  lastResult: null,
};

export const useStore = create<State>()(
  persist(
    (set, get) => {
      const finish = (r: RoundState) => {
        const stats = computeStats(r);
        const lessons = lessonsFor(stats, r.trades.filter((t) => t.reckless).length);
        const survived = r.status === 'survived';
        const s = get();
        const canUnlock = survived && !r.daily && r.scenarioId === s.unlocked && s.unlocked < SCENARIOS.length;
        const entry: HistoryEntry = {
          id: `${r.startedAt}`,
          scenarioId: r.scenarioId,
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
          activeNews: null,
          pauseOpen: false,
          history: [entry, ...s.history].slice(0, 100),
          unlocked: canUnlock ? s.unlocked + 1 : s.unlocked,
          survivedIds: survived && !s.survivedIds.includes(r.scenarioId) && !r.daily
            ? [...s.survivedIds, r.scenarioId] : s.survivedIds,
          dailyDone: r.daily ? dailyChallenge().key : s.dailyDone,
          lastResult: { round: r, stats, lessons, unlockedNew: canUnlock },
          pending: { mode: r.mode, scenarioId: r.scenarioId, seed: r.seed, daily: r.daily },
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
        beginFlow: (dailyFlow) => set({ dailyFlow, screen: 'mode' }),
        back: () => {
          const { screen, settingsBack, pauseOpen } = get();
          if (screen === 'game') set({ pauseOpen: !pauseOpen });
          else if (screen === 'settings') set({ screen: settingsBack, pauseOpen: settingsBack === 'game' });
          else if (screen === 'briefing') set({ screen: 'mode' });
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
            set({ pending: { mode, scenarioId: d.scenarioId, seed: d.seed, daily: true }, screen: 'briefing' });
          } else {
            set({ pending: { mode, scenarioId: scenarioId ?? 1, seed: randomSeed(), daily: false }, screen: 'briefing' });
          }
        },
        startRound: () => {
          const p = get().pending;
          if (!p) return;
          set({ round: newRound(p), activeNews: null, pauseOpen: false, screen: 'game' });
        },
        restartRound: () => {
          const r = get().round;
          if (!r) return;
          // daily keeps its seed; normal rounds get a fresh one
          const seed = r.daily ? r.seed : randomSeed();
          set({ round: newRound({ scenarioId: r.scenarioId, mode: r.mode, daily: r.daily, seed }), activeNews: null, pauseOpen: false });
        },
        next: () => {
          const { round: r, activeNews } = get();
          if (!r || r.status !== 'playing' || activeNews) return;
          const candles = roundCandles(r);
          let n = applyCandle(r, candles[r.index + 1]);
          const news = newsAt(n.scenarioId, n.index);
          let shown: string | null = null;
          if (news && !n.newsSeen.includes(news.at)) {
            n = { ...n, newsSeen: [...n.newsSeen, news.at] };
            shown = news.text;
          }
          if (n.status !== 'playing') return finish(n);
          set({ round: n, activeNews: shown });
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
        activeNews: s.activeNews,
        dailyDone: s.dailyDone,
        lastResult: s.lastResult,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        // settings merge per-key so new settings get defaults on old saves
        const merged = { ...current, ...p, settings: { ...current.settings, ...(p.settings ?? {}) } };
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
