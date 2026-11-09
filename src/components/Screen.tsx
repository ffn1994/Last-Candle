import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useScreenFocus } from '../device';

/** Wraps every screen with the fade + slide transition. */
export function Screen({ children, className = '', focusKey }: { children: ReactNode; className?: string; focusKey?: unknown }) {
  const ref = useScreenFocus<HTMLDivElement>(focusKey);
  return (
    <motion.div
      ref={ref}
      className={`absolute inset-0 flex flex-col overflow-y-auto safe-x ${className}`}
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

export function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="safe-top flex items-center gap-2 px-3 pb-2">
      <button
        type="button" onClick={onBack} aria-label="رجوع"
        className="flex h-11 w-11 items-center justify-center rounded-xl text-2xl text-muted active:scale-95"
      >
        →
      </button>
      <h1 className="text-xl font-bold">{title}</h1>
    </div>
  );
}
