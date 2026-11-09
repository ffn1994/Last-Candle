/** Haptics + tiny synthesized sound effects (no audio files → works offline). */
import { useStore } from './store';

export function haptic(ms = 10) {
  if (!useStore.getState().settings.haptics) return;
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(ms);
}

let ac: AudioContext | null = null;
function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.05, slideTo?: number) {
  if (!useStore.getState().settings.sound) return;
  try {
    // older Safari only has the prefixed constructor
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    ac ??= new Ctx();
    const t = ac.currentTime;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ac.destination);
    o.start(t);
    o.stop(t + dur);
  } catch {
    /* audio unavailable */
  }
}

export const sfx = {
  tick: () => tone(520, 0.04, 'sine', 0.015),
  open: () => tone(440, 0.12, 'triangle', 0.05, 660),
  win: () => { tone(660, 0.12, 'triangle', 0.05); setTimeout(() => tone(880, 0.18, 'triangle', 0.05), 90); },
  loss: () => tone(300, 0.25, 'sawtooth', 0.03, 180),
  news: () => tone(780, 0.1, 'square', 0.03),
  end: (good: boolean) => (good ? sfx.win() : tone(220, 0.6, 'sine', 0.06, 110)),
};
