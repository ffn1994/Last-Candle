/**
 * Shareable result card: a 1080×1350 image (Instagram portrait) drawn on a
 * canvas, shared through the system share sheet where available, otherwise
 * downloaded with the text copied to the clipboard.
 */
import { ar } from './i18n/ar';
import type { Grade } from './game/scoring';

export interface ShareData {
  survived: boolean;
  market: string; // revealed market name
  grade: Grade;
  returnPct: number;
  maxDrawdownPct: number;
  discipline: number;
}

const W = 1080;
const H = 1350;
const GOLD = '#F0B90B';
const FONT = '"IBM Plex Sans Arabic", system-ui, sans-serif';
const GRADE_COLOR: Record<Grade, string> = { S: GOLD, A: '#16C784', B: '#EAECEF', C: '#848E9C', F: '#EA3943' };

export const shareUrl = () => (typeof location !== 'undefined' ? location.origin : 'https://last-candle.vercel.app');

export function shareText(d: ShareData): string {
  return ar.share.text(d.survived, d.market, d.grade, d.discipline, shareUrl());
}

/** Rounded rectangle path (canvas roundRect is missing in older TV / iPad browsers). */
function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function candle(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const glow = ctx.createRadialGradient(x, y - 40 * s, 0, x, y - 40 * s, 140 * s);
  glow.addColorStop(0, 'rgba(240,185,11,0.45)');
  glow.addColorStop(1, 'rgba(240,185,11,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 160 * s, y - 200 * s, 320 * s, 320 * s);
  const flame = ctx.createLinearGradient(0, y - 20 * s, 0, y - 95 * s);
  flame.addColorStop(0, '#E07A00');
  flame.addColorStop(0.55, GOLD);
  flame.addColorStop(1, '#FFF3C4');
  ctx.fillStyle = flame;
  ctx.beginPath();
  ctx.moveTo(x, y - 95 * s);
  ctx.bezierCurveTo(x + 24 * s, y - 64 * s, x + 24 * s, y - 40 * s, x, y - 20 * s);
  ctx.bezierCurveTo(x - 24 * s, y - 40 * s, x - 24 * s, y - 64 * s, x, y - 95 * s);
  ctx.fill();
  ctx.fillStyle = GOLD;
  ctx.fillRect(x - 3 * s, y - 20 * s, 6 * s, 20 * s); // wick
  ctx.fillRect(x - 28 * s, y, 56 * s, 90 * s); // body
  ctx.fillRect(x - 3 * s, y + 90 * s, 6 * s, 24 * s);
}

export async function renderShareCard(d: ShareData): Promise<Blob> {
  // make sure the Arabic font is ready before drawing text
  try {
    await Promise.all([document.fonts.load(`700 80px ${FONT}`), document.fonts.load(`400 40px ${FONT}`)]);
  } catch { /* draw with the fallback font */ }

  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#11161C');
  bg.addColorStop(1, '#0B0E11');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const text = (s: string, y: number, size: number, color: string, weight = 700) => {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.fillText(s, W / 2, y);
  };

  candle(ctx, W / 2, 230, 1.15);
  text(ar.appTitle, 420, 64, GOLD);
  text(d.survived ? ar.share.survived : ar.share.liquidated, 540, 104, d.survived ? '#EAECEF' : '#EA3943');
  // keep number ranges like 2006–2010 left-to-right inside the Arabic line
  text(d.market.replace(/(\d+)\s*[–-]\s*(\d+)/g, '\u2066$1–$2\u2069'), 640, 52, '#EAECEF', 400);

  // grade badge
  const gc = GRADE_COLOR[d.grade];
  ctx.beginPath();
  ctx.arc(W / 2, 820, 120, 0, Math.PI * 2);
  ctx.fillStyle = '#151A21';
  ctx.fill();
  ctx.lineWidth = 12;
  ctx.strokeStyle = gc;
  ctx.stroke();
  ctx.direction = 'ltr';
  text(d.grade, 826, 150, gc);
  ctx.direction = 'rtl';

  // stats
  const stats: [string, string, string][] = [
    [ar.end.discipline, `${d.discipline}/100`, GOLD],
    [ar.end.returnPct, `${d.returnPct >= 0 ? '+' : ''}${d.returnPct.toFixed(1)}%`, d.returnPct >= 0 ? '#16C784' : '#EA3943'],
    [ar.end.maxDd, `${d.maxDrawdownPct.toFixed(1)}%`, '#EA3943'],
  ];
  stats.forEach(([label, value, color], k) => {
    const x = W - 200 - k * 340; // right to left
    ctx.fillStyle = '#151A21';
    rrect(ctx, x - 150, 1000, 300, 150, 28);
    ctx.fill();
    ctx.font = `400 34px ${FONT}`;
    ctx.fillStyle = '#848E9C';
    ctx.fillText(label, x, 1045);
    ctx.direction = 'ltr';
    ctx.font = `700 54px ${FONT}`;
    ctx.fillStyle = color;
    ctx.fillText(value, x, 1105);
    ctx.direction = 'rtl';
  });

  text(ar.share.cta, 1225, 42, '#EAECEF', 400);
  ctx.direction = 'ltr';
  text(shareUrl().replace(/^https?:\/\//, ''), 1285, 36, GOLD, 400);

  return new Promise((ok, fail) => cv.toBlob((b) => (b ? ok(b) : fail(new Error('canvas'))), 'image/png'));
}

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

/** Share the card (system sheet) or download it and copy the text. */
export async function shareResult(d: ShareData): Promise<ShareOutcome> {
  const blob = await renderShareCard(d);
  const file = new File([blob], 'last-candle.png', { type: 'image/png' });
  const msg = shareText(d);
  const nav = navigator as Navigator & { canShare?: (x: unknown) => boolean };
  try {
    if (nav.share && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], text: msg });
      return 'shared';
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return 'cancelled';
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'last-candle.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  try { await navigator.clipboard.writeText(msg); } catch { /* clipboard unavailable */ }
  return 'downloaded';
}
