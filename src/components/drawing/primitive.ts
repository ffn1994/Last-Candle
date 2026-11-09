import type {
  IChartApi, IPrimitivePaneRenderer, IPrimitivePaneView, ISeriesApi, ISeriesPrimitive, Logical,
  SeriesAttachedParameter, SeriesType, Time,
} from 'lightweight-charts';
import { fibPrices, rayEnd, type Drawing, type Pt, type XY } from '../../game/drawings';
import { fmtPrice } from '../../format';

type Target = Parameters<IPrimitivePaneRenderer['draw']>[0];

export const DRAW_COLORS: Record<Drawing['kind'], string> = {
  hline: '#3B82F6',
  trend: '#F0B90B',
  ray: '#F0B90B',
  rect: '#A855F7',
  fib: '#848E9C',
  text: '#EAECEF',
};
const FIB_COLORS = ['#848E9C', '#EA3943', '#F97316', '#16C784', '#06B6D4', '#3B82F6', '#848E9C'];

export interface DrawState {
  drawings: Drawing[];
  preview: Drawing | null;
  selected: string | null;
}

/**
 * Renders drawings on the price pane's own canvas, so they move with every
 * pan, zoom and price-scale change without any React re-render.
 */
export class DrawingsPrimitive implements ISeriesPrimitive<Time> {
  private chart: IChartApi | null = null;
  private series: ISeriesApi<SeriesType> | null = null;
  private request: (() => void) | null = null;
  private state: DrawState = { drawings: [], preview: null, selected: null };
  private readonly view: IPrimitivePaneView = { renderer: () => ({ draw: (t: Target) => this.draw(t) }) };

  attached(p: SeriesAttachedParameter<Time>) {
    this.chart = p.chart as IChartApi;
    this.series = p.series;
    this.request = p.requestUpdate;
  }

  detached() {
    this.chart = null;
    this.series = null;
    this.request = null;
  }

  paneViews() { return [this.view]; }

  set(state: DrawState) {
    this.state = state;
    this.request?.();
  }

  toXY = (pt: Pt): XY | null => {
    if (!this.chart || !this.series) return null;
    const x = this.chart.timeScale().logicalToCoordinate(pt.i as Logical);
    const y = this.series.priceToCoordinate(pt.p);
    return x == null || y == null ? null : { x, y };
  };

  private draw(target: Target) {
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      const { drawings, preview, selected } = this.state;
      for (const d of drawings) this.drawOne(ctx, d, mediaSize.width, d.id === selected, false);
      if (preview) this.drawOne(ctx, preview, mediaSize.width, false, true);
    });
  }

  private drawOne(ctx: CanvasRenderingContext2D, d: Drawing, width: number, selected: boolean, preview: boolean) {
    const a = this.toXY(d.a);
    if (!a) return;
    const color = DRAW_COLORS[d.kind];
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = selected ? 3 : 2;
    if (preview) ctx.setLineDash([6, 4]);
    ctx.font = '600 11px "IBM Plex Sans Arabic", system-ui, sans-serif';

    const line = (p: XY, q: XY) => { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); };
    const dot = (p: XY) => { ctx.beginPath(); ctx.arc(p.x, p.y, selected ? 5 : 3, 0, Math.PI * 2); ctx.fill(); };

    switch (d.kind) {
      case 'hline': {
        line({ x: 0, y: a.y }, { x: width, y: a.y });
        const label = fmtPrice(d.a.p);
        const w = ctx.measureText(label).width + 10;
        ctx.fillRect(width - w - 4, a.y - 9, w, 18);
        ctx.fillStyle = '#fff';
        ctx.fillText(label, width - w + 1, a.y + 4);
        break;
      }
      case 'trend':
      case 'ray': {
        const b = this.toXY(d.b);
        if (!b) break;
        line(a, d.kind === 'ray' ? rayEnd(a, b, width) : b);
        dot(a);
        dot(b);
        break;
      }
      case 'rect': {
        const b = this.toXY(d.b);
        if (!b) break;
        const x = Math.min(a.x, b.x);
        const y = Math.min(a.y, b.y);
        const w = Math.abs(b.x - a.x);
        const h = Math.abs(b.y - a.y);
        ctx.globalAlpha = 0.15;
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 1;
        ctx.strokeRect(x, y, w, h);
        break;
      }
      case 'fib': {
        const b = this.toXY(d.b);
        if (!b) break;
        const x0 = Math.min(a.x, b.x);
        const x1 = Math.max(a.x, b.x, x0 + 40);
        ctx.lineWidth = selected ? 2 : 1;
        const levels = fibPrices(d.a.p, d.b.p);
        levels.forEach((lv, k) => {
          const y = this.series?.priceToCoordinate(lv.price);
          if (y == null) return;
          // shaded band up to the next level
          const next = levels[k + 1] && this.series?.priceToCoordinate(levels[k + 1].price);
          if (next != null && next !== undefined) {
            ctx.globalAlpha = 0.06;
            ctx.fillStyle = FIB_COLORS[k];
            ctx.fillRect(x0, Math.min(y, next), x1 - x0, Math.abs(next - y));
            ctx.globalAlpha = 1;
          }
          ctx.strokeStyle = FIB_COLORS[k];
          ctx.fillStyle = FIB_COLORS[k];
          line({ x: x0, y }, { x: x1, y });
          ctx.fillText(`${lv.level} (${fmtPrice(lv.price)})`, x0 + 4, y - 3);
        });
        ctx.strokeStyle = color;
        ctx.setLineDash([3, 3]);
        line(a, b);
        break;
      }
      case 'text': {
        ctx.font = '600 12px "IBM Plex Sans Arabic", system-ui, sans-serif';
        ctx.direction = 'rtl';
        const w = ctx.measureText(d.text).width + 14;
        ctx.fillStyle = 'rgba(30,36,44,0.92)';
        ctx.strokeStyle = selected ? '#F0B90B' : '#2A313B';
        ctx.lineWidth = selected ? 2 : 1;
        ctx.beginPath();
        ctx.rect(a.x - w / 2, a.y - 11, w, 22);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.fillText(d.text, a.x, a.y + 4);
        break;
      }
    }
    ctx.restore();
  }
}
