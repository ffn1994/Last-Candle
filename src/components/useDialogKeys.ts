import { useEffect } from 'react';
import { focusPrimarySoon, isBackKey, isKeyboardMode } from '../device';

/** Escape / remote-back closes the dialog (and nothing behind it); keyboard users get focus inside. */
export function useDialogKeys(open: boolean, onClose?: () => void) {
  useEffect(() => {
    if (!open) return;
    const cancel = isKeyboardMode() ? focusPrimarySoon() : () => {};
    const onKey = (e: KeyboardEvent) => {
      if (!isBackKey(e) || !onClose) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose();
    };
    // capture phase so it runs before screen-level handlers
    addEventListener('keydown', onKey, true);
    return () => { cancel(); removeEventListener('keydown', onKey, true); };
  }, [open, onClose]);
}
