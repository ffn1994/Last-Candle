import { AnimatePresence, motion } from 'framer-motion';
import { useDialogKeys } from './useDialogKeys';
import { Button } from './Button';

interface Props {
  open: boolean;
  message: string;
  confirm: string;
  cancel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function Modal({ open, message, confirm, cancel, danger, onConfirm, onCancel }: Props) {
  useDialogKeys(open, onCancel);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <motion.div className="absolute inset-0 bg-black/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel} />
          <motion.div
            role="alertdialog"
            className="relative w-full max-w-[25rem] rounded-2xl border border-border bg-surface p-5"
            initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.18 }}
          >
            <p className="mb-5 text-lg leading-relaxed">{message}</p>
            <div className="flex gap-3">
              <Button variant={danger ? 'sell' : 'gold'} className="flex-1" size="md" onClick={onConfirm}>{confirm}</Button>
              <Button variant="secondary" className="flex-1" size="md" onClick={onCancel}>{cancel}</Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
