export type IndicatorId = 'ma20' | 'ma50' | 'ma100' | 'ema20' | 'bb' | 'rsi' | 'macd';

export interface IndicatorDef {
  id: IndicatorId;
  short: string; // chip label (Latin, as on TradingView)
  color: string;
  pane: boolean; // own pane under the price chart
}

export const INDICATORS: IndicatorDef[] = [
  { id: 'ma20', short: 'MA 20', color: '#3B82F6', pane: false },
  { id: 'ma50', short: 'MA 50', color: '#A855F7', pane: false },
  { id: 'ma100', short: 'MA 100', color: '#F97316', pane: false },
  { id: 'ema20', short: 'EMA 20', color: '#06B6D4', pane: false },
  { id: 'bb', short: 'BB 20', color: '#848E9C', pane: false },
  { id: 'rsi', short: 'RSI 14', color: '#A855F7', pane: true },
  { id: 'macd', short: 'MACD', color: '#3B82F6', pane: true },
];

export const MACD_SIGNAL_COLOR = '#F97316';
export const MAX_INDICATORS = 3;
export const DEFAULT_INDICATORS: IndicatorId[] = ['ma20', 'ma50'];

export const indicatorDef = (id: IndicatorId) => INDICATORS.find((d) => d.id === id)!;
