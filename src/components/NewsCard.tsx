import { AnimatePresence, motion } from 'framer-motion';
import { useDialogKeys } from './useDialogKeys';
import { ar } from '../i18n/ar';
import { Button } from './Button';
import type { NewsItem } from '../game/eventText';

/** Scripted news (plain text) or a scheduled release with its own title. */
export function NewsCard({ text: item, onDismiss }: { text: string | NewsItem | null; onDismiss: () => void }) {
  const title = item && typeof item === 'object' ? item.title : ar.news.title;
  const text = item && typeof item === 'object' ? item.text : item;
  useDialogKeys(!!item, onDismiss);
  return (
    <AnimatePresence>
      {text && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-6">
          <motion.div className="absolute inset-0 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div
            role="alertdialog"
            className="relative w-full max-w-[25rem] rounded-2xl border border-gold/40 bg-surface p-5 glow-gold"
            initial={{ opacity: 0, y: 30, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }}
          >
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gold">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-gold" />
              </span>
              {title}
            </div>
            <p className="mb-5 whitespace-pre-line text-xl font-bold leading-relaxed">{text}</p>
            <Button variant="gold" className="w-full" onClick={onDismiss}>{ar.news.ok}</Button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
