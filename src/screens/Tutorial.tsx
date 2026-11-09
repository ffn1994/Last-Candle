import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { ar } from '../i18n/ar';
import { useStore } from '../store';

const icons = ['🕯️', '🛑', '🧠'];

export function Tutorial() {
  const finish = useStore((s) => s.finishTutorial);
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const slides = ar.tutorial.slides;
  const last = i === slides.length - 1;
  const goTo = (n: number) => {
    if (n < 0 || n >= slides.length) return;
    setDir(n > i ? 1 : -1);
    setI(n);
  };

  return (
    <Screen>
      <div className="safe-top flex justify-start px-3">
        <Button variant="ghost" size="md" onClick={finish}>{ar.tutorial.skip}</Button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={i}
            custom={dir}
            className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-8 text-center"
            // RTL: next slide comes in from the left
            initial={{ x: dir * -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: dir * 300, opacity: 0 }}
            transition={{ duration: 0.25 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.6}
            onDragEnd={(_, info) => {
              if (info.offset.x > 60) goTo(i + 1);
              else if (info.offset.x < -60) goTo(i - 1);
            }}
          >
            <div className="text-7xl">{icons[i]}</div>
            <h2 className="text-3xl font-bold text-gold">{slides[i].title}</h2>
            <p className="text-lg leading-relaxed text-muted">{slides[i].body}</p>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="flex justify-center gap-2 pb-4">
        {slides.map((_, n) => (
          <button key={n} type="button" aria-label={`${n + 1}`} onClick={() => goTo(n)}
            className={`h-2 rounded-full transition-all ${n === i ? 'w-6 bg-gold' : 'w-2 bg-border'}`} />
        ))}
      </div>
      <div className="safe-bottom px-4">
        <Button variant="gold" className="w-full" onClick={() => (last ? finish() : goTo(i + 1))}>
          {last ? ar.tutorial.done : ar.tutorial.next}
        </Button>
      </div>
    </Screen>
  );
}
