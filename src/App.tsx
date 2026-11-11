import { AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import { installDeviceInput, isBackKey } from './device';
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
import { Builder } from './screens/Builder';
import { Replay } from './screens/Replay';

const screens: Record<Screen, () => React.JSX.Element | null> = {
  splash: Splash, tutorial: Tutorial, menu: Menu, mode: ModeSelect, briefing: Briefing,
  game: Game, end: End, history: History, settings: Settings, builder: Builder, replay: Replay,
};

export default function App() {
  const screen = useStore((s) => s.screen);

  useEffect(installDeviceInput, []);

  // Escape / TV-remote back outside the game (the game screen handles its own).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || !isBackKey(e) || useStore.getState().screen === 'game') return;
      e.preventDefault();
      useStore.getState().back();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

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
    // The game uses the whole screen (two columns on wide screens); other screens stay a centred column.
    <div className={`relative mx-auto app-h w-full overflow-hidden bg-bg ${screen === 'game' ? 'max-w-[120rem]' : 'max-w-[30rem]'}`}>
      <AnimatePresence mode="wait">
        <Current key={screen} />
      </AnimatePresence>
    </div>
  );
}
