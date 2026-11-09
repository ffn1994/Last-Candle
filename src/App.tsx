import { AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import { useStore, type Screen } from './store';
import { Splash } from './screens/Splash';
import { Tutorial } from './screens/Tutorial';
import { Menu } from './screens/Menu';
import { ModeSelect } from './screens/ModeSelect';
import { Briefing } from './screens/Briefing';
import { Game } from './screens/Game';
import { End } from './screens/End';
import { History } from './screens/History';
import { Settings } from './screens/Settings';

const screens: Record<Screen, () => React.JSX.Element | null> = {
  splash: Splash, tutorial: Tutorial, menu: Menu, mode: ModeSelect, briefing: Briefing,
  game: Game, end: End, history: History, settings: Settings,
};

export default function App() {
  const screen = useStore((s) => s.screen);

  // Browser / Android back: never leave the app; route it through the store
  // (in-game it toggles the pause sheet).
  useEffect(() => {
    history.pushState({ lc: true }, '');
    const onPop = () => {
      history.pushState({ lc: true }, '');
      useStore.getState().back();
    };
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);

  const Current = screens[screen];
  return (
    <div className="relative mx-auto h-dvh w-full max-w-[480px] overflow-hidden bg-bg">
      <AnimatePresence mode="wait">
        <Current key={screen} />
      </AnimatePresence>
    </div>
  );
}
