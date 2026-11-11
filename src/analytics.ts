/**
 * Anonymous usage events (Vercel Web Analytics: no cookies, no personal data).
 * Only what helps improve the game: which markets are played, how rounds end,
 * and whether results get shared.
 */
import { track as vercelTrack } from '@vercel/analytics/react';

type Props = Record<string, string | number | boolean | null>;

export function track(event: 'round_start' | 'round_end' | 'share' | 'tool_unlocked' | 'market_designed', props: Props = {}) {
  try { vercelTrack(event, props); } catch { /* analytics unavailable (offline, blocked): ignore */ }
}
