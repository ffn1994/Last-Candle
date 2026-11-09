import { AnimatePresence, motion } from 'framer-motion';
import { ar } from '../i18n/ar';
import { Button } from './Button';

export function NewsCard({ text, onDismiss }: { text: string | null; onDismiss: () => void }) {
  return (
    <AnimatePresence>
      {text && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-6">
          <motion.div className="absolute inset-0 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div
            role="alertdialog"
            className="relative w-full max-w-[400px] rounded-2xl border border-gold/40 bg-surface p-5 glow-gold"
            initial={{ opacity: 0, y: 30, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }}
          >
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gold">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-gold" />
              </span>
              {ar.news.title}
            </div>
            <p className="mb-5 text-xl font-bold leading-relaxed">{text}</p>
            <Button variant="gold" className="w-full" onClick={onDismiss}>{ar.news.ok}</Button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
