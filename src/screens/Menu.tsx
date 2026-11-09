import { useState } from 'react';
import { Button } from '../components/Button';
import { Flame } from '../components/Flame';
import { Modal } from '../components/Modal';
import { Screen } from '../components/Screen';
import { ar } from '../i18n/ar';
import { useStore } from '../store';
import { dailyChallenge } from '../data/scenarios';

export function Menu() {
  const round = useStore((s) => s.round);
  const dailyDone = useStore((s) => s.dailyDone);
  const { go, openSettings, beginFlow } = useStore.getState();
  const [confirm, setConfirm] = useState<boolean | null>(null); // value = daily?
  const doneToday = dailyDone === dailyChallenge().key;

  // Starting a new round replaces the saved one, so warn first.
  const ask = (daily: boolean) => (round ? setConfirm(daily) : beginFlow(daily));

  return (
    <Screen className="items-center px-6">
      <div className="flex flex-1 flex-col items-center justify-center gap-2">
        <Flame size={80} />
        <h1 className="text-4xl font-bold text-gold text-glow">{ar.appTitle}</h1>
        <p className="text-muted">{ar.tagline}</p>
      </div>
      <div className="safe-bottom flex w-full max-w-sm flex-col gap-3 pb-6">
        <Button variant="gold" onClick={() => ask(false)}>{ar.menu.start}</Button>
        {round && <Button variant="secondary" onClick={() => go('game')}>{ar.menu.resume}</Button>}
        <Button variant="secondary" onClick={() => ask(true)}>
          {ar.menu.daily}
          {doneToday && <span className="text-sm text-up">✓</span>}
        </Button>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => go('history')}>{ar.menu.history}</Button>
          <Button variant="secondary" className="flex-1" onClick={() => openSettings('menu')}>{ar.menu.settings}</Button>
        </div>
      </div>
      <Modal
        open={confirm !== null}
        message={ar.menu.replaceSaved}
        confirm={ar.pause.restartYes}
        cancel={ar.pause.exitNo}
        danger
        onConfirm={() => { const d = !!confirm; setConfirm(null); beginFlow(d); }}
        onCancel={() => setConfirm(null)}
      />
    </Screen>
  );
}
