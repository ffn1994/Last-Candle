/**
 * Device support: input mode (touch vs keyboard / TV remote), spatial focus
 * navigation with arrow keys, back keys from TV remotes, wide-layout detection
 * and fullscreen.
 */
import { useEffect, useRef, useState } from 'react';

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), [role="switch"]:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Escape, browser back, Samsung Tizen (10009) and LG webOS (461) remote back keys. */
export function isBackKey(e: KeyboardEvent): boolean {
  return (
    e.key === 'Escape' || e.key === 'GoBack' || e.key === 'BrowserBack' || e.key === 'XF86Back' ||
    e.keyCode === 10009 || e.keyCode === 461
  );
}

export const isKeyboardMode = () => document.documentElement.classList.contains('kbd');

function visible(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
}

/** The top-most open dialog, else the whole page. */
function scope(): ParentNode {
  const dialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
  return (dialogs[dialogs.length - 1] as HTMLElement | undefined) ?? document;
}

/** Focus the screen's / dialog's main action (gold button), else its first control. Returns false if there is none yet. */
export function focusPrimary(root: ParentNode = scope()): boolean {
  const list = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(visible);
  const el = list.find((x) => x.dataset.primary !== undefined) ?? list[0];
  el?.focus();
  return !!el;
}

/** Retry focusPrimary while a screen/dialog is still animating in. Returns a cancel function. */
export function focusPrimarySoon(): () => void {
  let tries = 0;
  let t = 0;
  const attempt = () => {
    const active = document.activeElement;
    const inside = active && active !== document.body && (scope() as Node).contains(active);
    if (inside || focusPrimary() || ++tries > 10) return;
    t = window.setTimeout(attempt, 150);
  };
  t = window.setTimeout(attempt, 250);
  return () => window.clearTimeout(t);
}

/**
 * For keyboard / TV-remote users: focus this screen's main action once it is on
 * screen. Scoped to the screen's own root so a screen that is still animating
 * out can never take the focus. Re-runs when `dep` changes (in-screen steps).
 */
export function useScreenFocus<T extends HTMLElement>(dep?: unknown) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!isKeyboardMode()) return;
    let tries = 0;
    let t = 0;
    const attempt = () => {
      const root = ref.current;
      if (root && focusPrimary(root)) return;
      if (++tries < 10) t = window.setTimeout(attempt, 120);
    };
    t = window.setTimeout(attempt, 80);
    return () => window.clearTimeout(t);
  }, [dep]);
  return ref;
}

type Dir = 'up' | 'down' | 'left' | 'right';

function move(dir: Dir) {
  const root = scope();
  const list = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(visible);
  const cur = document.activeElement as HTMLElement | null;
  if (!cur || !list.includes(cur)) return focusPrimary(root);
  const a = cur.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of list) {
    if (el === cur) continue;
    const b = el.getBoundingClientRect();
    const dx = b.left + b.width / 2 - ax;
    const dy = b.top + b.height / 2 - ay;
    const ok = dir === 'right' ? dx > 4 : dir === 'left' ? dx < -4 : dir === 'down' ? dy > 4 : dy < -4;
    if (!ok) continue;
    const along = dir === 'left' || dir === 'right' ? Math.abs(dx) : Math.abs(dy);
    const across = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
    const score = along + across * 2;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  best?.focus();
}

let installed = false;
/** Call once at startup. */
export function installDeviceInput() {
  if (installed) return;
  installed = true;
  const html = document.documentElement;
  addEventListener('pointerdown', () => html.classList.remove('kbd'), true);
  addEventListener('keydown', (e) => {
    if (e.key === 'Tab' || e.key.startsWith('Arrow') || e.key === 'Enter') html.classList.add('kbd');
    // Enter with nothing focused (TV remote, first press): focus the main action instead of doing nothing
    if (e.key === 'Enter' && (!document.activeElement || document.activeElement === document.body)) {
      e.preventDefault();
      focusPrimary();
      return;
    }
    if (e.defaultPrevented || !e.key.startsWith('Arrow')) return;
    const t = e.target as HTMLElement;
    // inside text fields, left/right move the caret; up/down leave the field
    if (t.tagName === 'INPUT' && (t as HTMLInputElement).type !== 'checkbox' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
    e.preventDefault();
    move(e.key.slice(5).toLowerCase() as Dir);
  });
}

/** Landscape screens wide enough for the two-column game layout (tablets, laptops, TVs, phones on their side). */
const WIDE_QUERY = '(min-width: 700px) and (min-aspect-ratio: 11/10)';

export function useWide() {
  const get = () => typeof matchMedia !== 'undefined' && matchMedia(WIDE_QUERY).matches;
  const [wide, setWide] = useState(get);
  useEffect(() => {
    const mq = matchMedia(WIDE_QUERY);
    const on = () => setWide(mq.matches);
    // Safari < 14 only has addListener
    if (mq.addEventListener) mq.addEventListener('change', on); else mq.addListener(on);
    return () => { if (mq.removeEventListener) mq.removeEventListener('change', on); else mq.removeListener(on); };
  }, []);
  return wide;
}

/** Fine pointer + hover = mouse/trackpad (laptops): show keyboard shortcut hints. */
export const hasMouse = () => typeof matchMedia !== 'undefined' && matchMedia('(hover: hover) and (pointer: fine)').matches;

type FsDoc = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void; webkitFullscreenEnabled?: boolean };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => void };

export const canFullscreen = () => {
  const d = document as FsDoc;
  return !!(d.fullscreenEnabled || d.webkitFullscreenEnabled);
};

export function toggleFullscreen() {
  const d = document as FsDoc;
  const el = document.documentElement as FsEl;
  if (d.fullscreenElement || d.webkitFullscreenElement) {
    if (d.exitFullscreen) void d.exitFullscreen(); else d.webkitExitFullscreen?.();
  } else if (el.requestFullscreen) void el.requestFullscreen().catch(() => {});
  else el.webkitRequestFullscreen?.();
}
