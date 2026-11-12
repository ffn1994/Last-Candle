import { useEffect, useState } from 'react';
import { Header, Screen } from '../components/Screen';
import { BoardRows } from '../components/DailyBoard';
import { Button } from '../components/Button';
import { ar } from '../i18n/ar';
import { useStore } from '../store';
import { todayKey } from '../data/scenarios';
import { fetchLeaderboard, type LeaderRow } from '../online/leaderboard';

/** Today's daily-challenge leaderboard (verified scores only). */
export function Leaderboard() {
  const { go, beginFlow } = useStore.getState();
  const nickname = useStore((s) => s.nickname);
  const [rows, setRows] = useState<LeaderRow[] | 'offline' | null>(null);
  const day = todayKey();
  useEffect(() => { void fetchLeaderboard(day, 50).then(setRows); }, [day]);

  return (
    <Screen>
      <Header title={`🏆 ${ar.board.title}`} onBack={() => go('menu')} />
      <div className="flex-1 space-y-3 px-4 pb-4">
        <p className="text-sm text-muted">{ar.board.screenDesc}</p>
        {rows === null ? <p className="py-6 text-center text-muted">{ar.board.loading}</p>
          : rows === 'offline' ? <p className="py-6 text-center text-down">{ar.board.errors.offline}</p>
          : <BoardRows rows={rows} mine={nickname} />}
      </div>
      <div className="safe-bottom px-4 pt-2">
        <Button variant="gold" className="w-full" onClick={() => beginFlow(true)}>{ar.menu.daily}</Button>
      </div>
    </Screen>
  );
}
