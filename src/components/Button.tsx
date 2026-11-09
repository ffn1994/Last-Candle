import { motion } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { haptic } from '../fx';

type Variant = 'buy' | 'sell' | 'gold' | 'secondary' | 'ghost';

const styles: Record<Variant, string> = {
  buy: 'bg-up text-white',
  sell: 'bg-down text-white',
  gold: 'bg-gold text-bg glow-gold',
  secondary: 'bg-surface-2 text-text border border-border',
  ghost: 'bg-transparent text-muted',
};

interface Props {
  variant?: Variant;
  onClick?: () => void;
  /** Fires after `longPressMs` held; a short tap still fires onClick. */
  onLongPress?: () => void;
  longPressMs?: number;
  /** When set, onClick only fires after holding this long (progress shown). */
  holdMs?: number;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
  size?: 'lg' | 'md' | 'icon';
  /** Main action of its screen/dialog: focused first for keyboard and TV-remote users. Gold buttons are primary by default. */
  primary?: boolean;
}

const sizes = {
  lg: 'h-14 rounded-[14px] text-lg font-bold px-4',
  md: 'h-12 rounded-xl text-base font-semibold px-4',
  icon: 'h-11 w-11 min-w-[2.75rem] rounded-xl text-lg',
};

export function Button({
  variant = 'secondary', onClick, onLongPress, longPressMs = 450, holdMs, disabled, className = '',
  children, ariaLabel, size = 'lg', primary,
}: Props) {
  const [pressed, setPressed] = useState(false);
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const fired = useRef(false);

  const clear = () => {
    window.clearTimeout(timer.current);
    setPressed(false);
    setHolding(false);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Pointer and keyboard share the same press logic, so holding Enter on a
  // TV remote works like a long-press / hold-to-confirm.
  const press = () => {
    if (disabled) return;
    fired.current = false;
    setPressed(true);
    haptic(10);
    if (holdMs) {
      setHolding(true);
      timer.current = window.setTimeout(() => {
        fired.current = true;
        haptic(25);
        clear();
        onClick?.();
      }, holdMs);
    } else if (onLongPress) {
      timer.current = window.setTimeout(() => {
        fired.current = true;
        haptic(25);
        onLongPress();
      }, longPressMs);
    }
  };
  const down = (e: React.PointerEvent) => {
    if (e.button > 0) return;
    press();
  };
  const up = () => {
    if (disabled) return;
    const shouldClick = pressed && !fired.current && !holdMs;
    clear();
    if (shouldClick) onClick?.();
  };

  return (
    <motion.button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      animate={{ scale: pressed ? 0.96 : 1 }}
      transition={{ duration: 0.08 }}
      onPointerDown={down}
      onPointerUp={up}
      onPointerLeave={clear}
      onPointerCancel={clear}
      onContextMenu={(e) => e.preventDefault()}
      data-primary={(primary ?? variant === 'gold') ? '' : undefined}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        e.stopPropagation(); // don't also trigger screen-level shortcuts (Space = next candle)
        if (!e.repeat) press();
      }}
      onKeyUp={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        up();
      }}
      onBlur={clear}
      className={`relative select-none overflow-hidden touch-manipulation flex items-center justify-center gap-2
        ${sizes[size]} ${styles[variant]} ${disabled ? 'opacity-40 pointer-events-none' : ''} ${className}`}
    >
      {holdMs && holding && (
        <motion.span
          className="absolute inset-y-0 right-0 bg-white/25"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: holdMs / 1000, ease: 'linear' }}
        />
      )}
      <span className="relative flex items-center gap-2">{children}</span>
    </motion.button>
  );
}
