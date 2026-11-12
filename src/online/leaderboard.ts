/**
 * Daily-challenge leaderboard client. No accounts: the device keeps a random
 * player id and secret; the server stores only a hash of the secret and
 * re-plays the submitted actions to compute the score itself.
 */
import { hashString } from '../game/rng';
import { todayKey } from '../data/scenarios';
import type { Action, Mode, RoundState } from '../game/types';

// Public client settings (the publishable key is meant to ship in apps).
const SUPABASE_URL = 'https://emiofdqepqolotbdxmlc.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_2zhj-mzxYIvQSJ-BMDY0Lw_WXFHmMRV';

const ID_KEY = 'last-candle-player';

function uuid(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** This device's anonymous player identity (created on first use). */
export function playerIdentity(): { playerId: string; secret: string } {
  try {
    const saved = JSON.parse(localStorage.getItem(ID_KEY) ?? 'null');
    if (saved?.playerId && saved?.secret) return saved;
  } catch { /* corrupted: make a new one */ }
  const id = { playerId: uuid(), secret: `${uuid()}${uuid()}`.replace(/-/g, '') };
  localStorage.setItem(ID_KEY, JSON.stringify(id));
  return id;
}

/** The date key a daily round was dealt from (the seed is the hash of that date). */
export function dailyDayOf(r: RoundState): string | null {
  for (const offset of [0, -1, 1, -2]) {
    const d = new Date(r.startedAt + offset * 86_400_000);
    const key = todayKey(d);
    if (hashString(key) === r.seed) return key;
  }
  return null;
}

export interface SubmitResult {
  status: 'ok' | 'exists';
  rank: number;
  total: number;
  result: { score: number; discipline: number; grade: string; return_pct: number; trades: number };
}

export type SubmitError = 'offline' | 'nickname' | 'auth' | 'day' | 'invalid' | 'server';

export async function submitDaily(r: RoundState, nickname: string): Promise<SubmitResult | SubmitError> {
  const day = dailyDayOf(r);
  if (!day) return 'day';
  const body = { day, mode: r.mode as Mode, actions: (r.actions ?? []) as Action[], nickname: nickname.trim(), ...playerIdentity() };
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/submit-daily`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: PUBLISHABLE_KEY },
      body: JSON.stringify(body),
    });
  } catch {
    return 'offline';
  }
  const data = await res.json().catch(() => ({}));
  if (res.ok) return data as SubmitResult;
  const e = (data as { error?: string }).error;
  return e === 'nickname' ? 'nickname' : e === 'auth' ? 'auth' : e === 'day' ? 'day' : res.status === 400 ? 'invalid' : 'server';
}

export interface LeaderRow {
  rank: number; nickname: string; grade: string; score: number; discipline: number;
  return_pct: number; max_dd: number; trades: number; survived: boolean; mode: Mode;
}

export async function fetchLeaderboard(day: string, limit = 50): Promise<LeaderRow[] | 'offline'> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/daily_leaderboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: PUBLISHABLE_KEY },
      body: JSON.stringify({ p_day: day, p_limit: limit }),
    });
    if (!res.ok) return 'offline';
    return (await res.json()) as LeaderRow[];
  } catch {
    return 'offline';
  }
}
