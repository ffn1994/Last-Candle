import { useEffect, useRef } from 'react';

/**
 * On touch screens the tap that opens a dialog is followed by a synthetic
 * click that can land on the freshly shown backdrop and close it at once.
 * Ignore backdrop clicks for a moment after opening.
 */
export function useBackdropGuard(open: boolean, onClose?: () => void) {
  const openedAt = useRef(0);
  useEffect(() => { if (open) openedAt.current = Date.now(); }, [open]);
  return () => {
    if (Date.now() - openedAt.current < 400) return;
    onClose?.();
  };
}
