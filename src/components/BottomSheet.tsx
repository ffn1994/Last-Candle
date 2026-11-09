import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose?: () => void;
  title?: ReactNode;
  children: ReactNode;
}

export function BottomSheet({ open, onClose, title, children }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-center">
          <motion.div
            className="absolute inset-0 bg-black/60"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            className="relative w-full max-w-[480px] bg-surface border-t border-border rounded-t-3xl px-4 pt-3 safe-bottom max-h-[92dvh] overflow-y-auto"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border" />
            {title && <h2 className="mb-4 text-xl font-bold">{title}</h2>}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
