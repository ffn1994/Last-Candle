import { BottomSheet } from './BottomSheet';
import { ar } from '../i18n/ar';
import { requiredLevel, type ToolId } from '../game/progression';
import { indicatorDef, type IndicatorId } from './indicatorDefs';
import type { ChartType, Timeframe } from '../store';
import { haptic } from '../fx';

interface Props {
  open: boolean;
  onClose: () => void;
  has: (t: ToolId) => boolean;
  indicators: IndicatorId[];
  drawOpen: boolean;
  drawCount: number;
  timeframe: Timeframe;
  chartType: ChartType;
  classicOn: boolean;
  fundSummary: string;
  onIndicators: () => void;
  onDraw: () => void;
  onTimeframe: () => void;
  onChartType: () => void;
  onClassic: () => void;
  onFundamentals: () => void;
  onLocked: (t: ToolId) => void;
}

/** One place for every chart tool: big, clear tiles instead of a crowded toolbar. */
export function ToolsSheet(p: Props) {
  const T = ar.tools;
  const tile = (key: string, tool: ToolId, icon: string, title: string, value: string, onClick: () => void, active = false) => {
    const locked = !p.has(tool);
    return (
      <button
        key={key} type="button"
        onClick={() => { haptic(10); if (locked) p.onLocked(tool); else onClick(); }}
        className={`flex min-h-[5.5rem] flex-col items-start justify-between rounded-2xl border p-3 text-start active:scale-[0.97] ${
          locked ? 'border-dashed border-border opacity-60' : active ? 'border-gold bg-gold/10' : 'border-border bg-surface-2'}`}
      >
        <span className="text-2xl" aria-hidden>{locked ? '🔒' : icon}</span>
        <span>
          <span className="block font-bold">{title}</span>
          <span className="block text-xs text-muted">{locked ? ar.progress.lockedShort(requiredLevel(tool)) : value}</span>
        </span>
      </button>
    );
  };
  return (
    <BottomSheet open={p.open} onClose={p.onClose} title={`🧰 ${T.title}`}>
      <div className="grid grid-cols-2 gap-2 pb-3">
        {tile('ind', 'chart', 'ƒx', ar.chart.indicators,
          p.indicators.length ? p.indicators.map((id) => indicatorDef(id).short).join('، ') : T.none, p.onIndicators, p.indicators.length > 0)}
        {tile('draw', 'drawing', '✏️', ar.draw.title, p.drawCount ? T.drawings(p.drawCount) : T.drawHint, p.onDraw, p.drawOpen)}
        {tile('tf', 'chart', '🗓', T.timeframe, ar.chart.tf[p.timeframe], p.onTimeframe)}
        {tile('type', 'chart', p.chartType === 'candles' ? '🕯' : p.chartType === 'ha' ? '◫' : '⟋', T.chartType, ar.chart.types[p.chartType], p.onChartType)}
        {tile('classic', 'classic', '📐', ar.classic.title, p.classicOn ? T.on : T.off, p.onClassic, p.classicOn)}
        {tile('fund', 'fundamentals', '📊', ar.fund.title, p.fundSummary, p.onFundamentals)}
      </div>
    </BottomSheet>
  );
}
