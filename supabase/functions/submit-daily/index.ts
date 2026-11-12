/**
 * submit-daily: verify a daily-challenge round by replaying its actions with
 * the game's own engine, then record it on the leaderboard.
 *
 * Bundled with esbuild (npm run build:fn) so it runs the exact engine code the
 * game uses. Players are anonymous: a device id + secret (only its hash is
 * stored); the first finished attempt of each day counts.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { SCENARIOS, CURRENT_GEN, generateCandles } from '../../../src/data/scenarios';
import { hashString } from '../../../src/game/rng';
import { verifyRound } from '../../../src/game/verify';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Players are in different time zones: accept yesterday, today and tomorrow (UTC). */
function dayAllowed(day: string) {
  const t = Date.parse(`${day}T00:00:00Z`);
  const now = Date.now();
  return Number.isFinite(t) && Math.abs(now - t) <= 2 * 86_400_000;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: 'json' }, 400); }

  const { day, mode, actions, playerId, secret } = body as Record<string, unknown>;
  const nickname = typeof body.nickname === 'string' ? body.nickname.trim() : '';
  if (typeof day !== 'string' || !DAY.test(day) || !dayAllowed(day)) return json({ error: 'day' }, 400);
  if (typeof playerId !== 'string' || !UUID.test(playerId)) return json({ error: 'player' }, 400);
  if (typeof secret !== 'string' || secret.length < 16 || secret.length > 128) return json({ error: 'secret' }, 400);
  if (nickname && (nickname.length < 2 || nickname.length > 20)) return json({ error: 'nickname' }, 400);

  // the daily challenge is fully determined by the date
  const seed = hashString(day);
  const scenarioId = SCENARIOS[seed % SCENARIOS.length].id;
  const candles = generateCandles(SCENARIOS[seed % SCENARIOS.length], seed, CURRENT_GEN);
  const verified = verifyRound({ scenarioId, seed, gen: CURRENT_GEN, mode: mode as 'normal', daily: true }, candles, actions);
  if (typeof verified === 'string') return json({ error: verified }, 400);
  const { stats, survived } = verified;

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const hash = await sha256(secret);

  // register or authenticate the player
  const { data: player, error: pErr } = await db.from('players').select('id, secret_hash, nickname').eq('id', playerId).maybeSingle();
  if (pErr) return json({ error: 'db' }, 500);
  if (!player) {
    if (!nickname) return json({ error: 'nickname' }, 400);
    const { error } = await db.from('players').insert({ id: playerId, secret_hash: hash, nickname });
    if (error) return json({ error: 'db' }, 500);
  } else {
    if (player.secret_hash !== hash) return json({ error: 'auth' }, 403);
    if (nickname && nickname !== player.nickname) await db.from('players').update({ nickname }).eq('id', playerId);
  }

  const row = {
    day, player_id: playerId, mode, market: scenarioId, survived,
    grade: stats.grade, score: stats.score, discipline: stats.discipline,
    return_pct: Math.round(stats.returnPct * 100) / 100, max_dd: Math.round(stats.maxDrawdownPct * 100) / 100, trades: stats.trades,
  };
  // the first finished attempt of the day counts
  const { error: insErr } = await db.from('daily_scores').insert(row);
  const already = !!insErr && insErr.code === '23505';
  if (insErr && !already) return json({ error: 'db' }, 500);

  const { data: mine } = await db.from('daily_scores').select('score, discipline, created_at, grade, return_pct, trades').eq('day', day).eq('player_id', playerId).single();
  const { count: better } = await db.from('daily_scores').select('*', { count: 'exact', head: true }).eq('day', day)
    .or(`score.gt.${mine!.score},and(score.eq.${mine!.score},discipline.gt.${mine!.discipline}),and(score.eq.${mine!.score},discipline.eq.${mine!.discipline},created_at.lt.${mine!.created_at})`);
  const { count: total } = await db.from('daily_scores').select('*', { count: 'exact', head: true }).eq('day', day);

  return json({ status: already ? 'exists' : 'ok', rank: (better ?? 0) + 1, total: total ?? 1, result: mine });
});
