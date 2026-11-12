import { useEffect, useState } from 'react';
import { ar } from '../i18n/ar';
import { useStore } from '../store';
import { Button } from './Button';
import { dailyDayOf, fetchLeaderboard, submitDaily, type LeaderRow, type SubmitResult } from '../online/leaderboard';
import type { RoundState } from '../game/types';

/** Top rows of a day's leaderboard, highlighting the player's own row. */
export function BoardRows({ rows, mine }: { rows: LeaderRow[]; mine?: string }) {
  if (!rows.length) return <p className="py-3 text-center text-sm text-muted">{ar.board.empty}</p>;
  return (
    <ol className="space-y-1">
      {rows.map((r) => (
        <li key={`${r.rank}${r.nickname}`} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${r.nickname === mine ? 'bg-gold/15' : 'bg-surface-2'}`}>
          <span className={`num w-7 text-center font-bold ${r.rank <= 3 ? 'text-gold' : 'text-muted'}`}>{r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}</span>
          <span className="min-w-0 flex-1 truncate font-semibold">{r.nickname}{r.mode === 'sharia' && <span className="mr-1 text-xs text-muted"> · {ar.history.sharia}</span>}</span>
          <span className="num text-xs text-muted">{ar.end.discipline} {r.discipline}</span>
          <span className={`num w-14 text-xs ${r.return_pct >= 0 ? 'text-up' : 'text-down'}`}>{r.return_pct >= 0 ? '+' : ''}{r.return_pct.toFixed(1)}%</span>
          <span className="num w-8 text-center font-bold">{r.grade}</span>
        </li>
      ))}
    </ol>
  );
}

/** End-of-round card for the daily challenge: nickname, verified submission, rank, top 10. */
export function DailyBoard({ round }: { round: RoundState }) {
  const nickname = useStore((s) => s.nickname);
  const setNickname = useStore((s) => s.setNickname);
  const [name, setName] = useState(nickname);
  const [state, setState] = useState<'idle' | 'sending' | SubmitResult | 'error'>('idle');
  const [err, setErr] = useState('');
  const [rows, setRows] = useState<LeaderRow[] | null>(null);
  const day = dailyDayOf(round);

  const send = async (nick: string) => {
    setState('sending');
    const res = await submitDaily(round, nick);
    if (typeof res === 'string') {
      setErr(ar.board.errors[res]);
      setState('error');
      return;
    }
    setNickname(nick);
    setState(res);
    if (day) { const l = await fetchLeaderboard(day, 10); if (l !== 'offline') setRows(l); }
  };

  // returning players: send automatically
  useEffect(() => { if (nickname) void send(nickname); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const valid = name.trim().length >= 2 && name.trim().length <= 20;
  return (
    <div className="w-full rounded-2xl border border-gold/50 bg-surface p-4">
      <h2 className="mb-3 font-bold text-gold">🏆 {ar.board.title}</h2>
      {typeof state === 'object' ? (
        <>
          <p className="mb-3 text-center">
            <span className="text-muted">{ar.board.yourRank} </span>
            <span className="num text-2xl font-bold text-gold">{state.rank}</span>
            <span className="text-muted"> {ar.board.of} </span><span className="num text-muted">{state.total}</span>
            {state.status === 'exists' && <span className="block text-xs text-muted">{ar.board.firstCounts}</span>}
          </p>
          {rows && <BoardRows rows={rows} mine={nickname} />}
        </>
      ) : state === 'sending' ? (
        <p className="py-3 text-center text-sm text-muted">{ar.board.sending}</p>
      ) : (
        <div className="space-y-2">
          {!nickname && <p className="text-sm text-muted">{ar.board.pickName}</p>}
          <input
            value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder={ar.board.namePlaceholder}
            className="h-11 w-full rounded-xl border border-border bg-surface-2 px-3 outline-none focus:border-gold"
          />
          {state === 'error' && <p className="text-sm text-down">{err}</p>}
          <Button variant="gold" size="md" className="w-full" disabled={!valid} onClick={() => send(name.trim())}>{ar.board.send}</Button>
          <p className="text-xs text-muted">{ar.board.verifiedNote}</p>
        </div>
      )}
    </div>
  );
}
