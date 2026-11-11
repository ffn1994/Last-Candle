import { Header, Screen } from '../components/Screen';
import { Flame } from '../components/Flame';
import { ar } from '../i18n/ar';
import { useStore } from '../store';

declare const __APP_VERSION__: string;

/** What the game is, the investment disclaimer, privacy, and data / library credits. */
export function About() {
  const go = useStore.getState().go;
  const A = ar.about;
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="mb-2 font-bold text-gold">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-text/90">{children}</div>
    </section>
  );
  return (
    <Screen>
      <Header title={A.title} onBack={() => go('menu')} />
      <div className="flex-1 space-y-3 px-4 pb-6">
        <div className="flex flex-col items-center gap-1 py-2">
          <Flame size={56} />
          <div className="text-2xl font-bold text-gold">{ar.appTitle}</div>
          <div className="num text-xs text-muted">v{__APP_VERSION__}</div>
        </div>
        <Section title={A.whatTitle}><p>{A.what}</p></Section>
        <Section title={A.disclaimerTitle}>{A.disclaimer.map((t) => <p key={t}>{t}</p>)}</Section>
        <Section title={A.dataTitle}>{A.data.map((t) => <p key={t}>{t}</p>)}</Section>
        <Section title={A.privacyTitle}>{A.privacy.map((t) => <p key={t}>{t}</p>)}</Section>
        <Section title={A.creditsTitle}>
          <p>
            {A.chartsCredit}{' '}
            <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer" className="text-gold underline">TradingView</a>
          </p>
        </Section>
      </div>
    </Screen>
  );
}
