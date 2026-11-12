export interface Candle {
  time: number; // index-based fake timestamp (seconds) — real dates would leak the scenario
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type Side = 'long' | 'short';
export type Mode = 'normal' | 'sharia';
export type CloseReason = 'stop' | 'tp' | 'manual' | 'liquidation' | 'end';
export type RoundStatus = 'playing' | 'liquidated' | 'survived';

export interface Position {
  side: Side;
  size: number; // units
  entry: number;
  stop: number | null;
  tp: number | null;
  openedAt: number; // candle index
  riskPct: number; // effective risk at open (% of equity)
  reckless: boolean; // opened without a stop
  revenge: boolean;
  analysis?: boolean; // entered at a level the player drew, stop beyond it
  pe?: number | null; // valuation when the trade was opened
  eventSoon?: boolean; // a scheduled earnings/rate event within the next 3 candles
}

export interface ClosedTrade {
  side: Side;
  size: number;
  entry: number;
  exit: number;
  pnl: number;
  openedAt: number;
  closedAt: number;
  reason: CloseReason;
  riskPct: number;
  reckless: boolean;
  revenge: boolean;
  analysis?: boolean;
  pe?: number | null;
  eventSoon?: boolean;
}

export type NerveReason = 'noStop' | 'widenStop' | 'revenge' | 'lossStreak' | 'byPlan' | 'patience' | 'analysis';

export interface NerveEvent {
  at: number;
  delta: number;
  reason: NerveReason;
}

export interface RoundState {
  scenarioId: number;
  mode: Mode;
  seed: number;
  daily: boolean;
  /** market generator version (missing = 1, rounds saved before v2) */
  gen?: number;
  index: number; // last visible candle
  cash: number; // realized equity
  position: Position | null;
  trades: ClosedTrade[];
  nerves: number;
  nervesLog: NerveEvent[];
  lastLossAt: number | null;
  consecutiveLosses: number;
  idleCandles: number;
  peakEquity: number;
  maxDrawdown: number; // 0..1
  stopWidenings: number;
  status: RoundStatus;
  newsSeen: number[]; // candle indexes of news already shown
  eventsSeen?: string[]; // scheduled events (earnings, rates, inflation) already released
  /** every accepted player action, so the round can be replayed and verified */
  actions?: Action[];
  startedAt: number; // epoch ms
}

/** A player action on candle `at` (taken at that candle's close, before the next one). */
export type Action =
  | { at: number; t: 'open'; side: Side; riskPct: number; stop: number | null; tp: number | null; analysis?: boolean }
  | { at: number; t: 'close' }
  | { at: number; t: 'stop'; price: number };

export interface OpenParams {
  side: Side;
  riskPct: number;
  stop: number | null;
  tp: number | null;
  analysis?: boolean; // computed by the caller from the player's drawings
  pe?: number | null; // fundamentals context, recorded for the lessons
  eventSoon?: boolean;
}
