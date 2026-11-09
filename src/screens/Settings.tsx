import { useState } from 'react';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { Header, Screen } from '../components/Screen';
import { ar } from '../i18n/ar';
import { useStore, type Speed } from '../store';

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
      className="flex min-h-14 w-full items-center justify-between rounded-2xl bg-surface px-4">
      <span className="text-lg">{label}</span>
      <span className={`relative h-7 w-12 rounded-full transition ${on ? 'bg-gold' : 'bg-surface-2 border border-border'}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all ${on ? 'right-0.5' : 'right-[22px]'}`} />
      </span>
    </button>
  );
}

export function Settings() {
  const settings = useStore((s) => s.settings);
  const { setSettings, back, resetProgress, replayTutorial } = useStore.getState();
  const [confirm, setConfirm] = useState(false);

  return (
    <Screen>
      <Header title={ar.settings.title} onBack={back} />
      <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-6">
        <Toggle label={ar.settings.sound} on={settings.sound} onChange={(sound) => setSettings({ sound })} />
        <Toggle label={ar.settings.haptics} on={settings.haptics} onChange={(haptics) => setSettings({ haptics })} />
        <Toggle label={ar.settings.candleMotion} on={settings.candleMotion} onChange={(candleMotion) => setSettings({ candleMotion })} />
        <div className="rounded-2xl bg-surface p-4">
          <div className="mb-3 text-lg">{ar.settings.speed}</div>
          <div className="grid grid-cols-3 gap-2">
            {([1, 2, 4] as Speed[]).map((s) => (
              <button key={s} type="button" onClick={() => setSettings({ speed: s })}
                className={`h-11 rounded-xl border font-semibold ${settings.speed === s ? 'border-gold bg-gold text-bg' : 'border-border bg-surface-2'}`}>
                <span className="num">{s}x</span>
              </button>
            ))}
          </div>
        </div>
        <Button variant="secondary" className="w-full" onClick={replayTutorial}>{ar.settings.replayTutorial}</Button>
        <Button variant="sell" className="w-full" onClick={() => setConfirm(true)}>{ar.settings.reset}</Button>
      </div>
      <Modal
        open={confirm} message={ar.settings.resetConfirm} confirm={ar.settings.resetYes} cancel={ar.settings.cancel} danger
        onConfirm={() => { setConfirm(false); resetProgress(); }}
        onCancel={() => setConfirm(false)}
      />
    </Screen>
  );
}
