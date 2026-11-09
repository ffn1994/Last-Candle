import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { Flame } from '../components/Flame';
import { ar } from '../i18n/ar';
import { useStore } from '../store';

export function Splash() {
  const tutorialSeen = useStore((s) => s.tutorialSeen);
  const go = useStore((s) => s.go);
  useEffect(() => {
    const t = window.setTimeout(() => go(tutorialSeen ? 'menu' : 'tutorial'), 1500);
    return () => window.clearTimeout(t);
  }, [go, tutorialSeen]);

  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-4" exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <Flame size={110} />
      <motion.h1 className="text-4xl font-bold text-gold text-glow" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        {ar.appTitle}
      </motion.h1>
      <motion.p className="text-muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
        {ar.tagline}
      </motion.p>
    </motion.div>
  );
}
