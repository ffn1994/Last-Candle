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
}

export type NerveReason = 'noStop' | 'widenStop' | 'revenge' | 'lossStreak' | 'byPlan' | 'patience';

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
  startedAt: number; // epoch ms
}

export interface OpenParams {
  side: Side;
  riskPct: number;
  stop: number | null;
  tp: number | null;
}
