import { motion } from 'framer-motion';
import type { Grade } from '../game/scoring';

const colors: Record<Grade, string> = {
  S: 'text-gold border-gold glow-gold',
  A: 'text-up border-up',
  B: 'text-text border-border',
  C: 'text-muted border-border',
  F: 'text-down border-down',
};

export function GradeBadge({ grade, size = 'lg', delay = 0 }: { grade: Grade; size?: 'lg' | 'sm'; delay?: number }) {
  const dims = size === 'lg' ? 'h-28 w-28 text-6xl border-4' : 'h-10 w-10 text-lg border-2';
  return (
    <motion.div
      initial={size === 'lg' ? { scale: 0, rotate: -20 } : false}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 14, delay }}
      className={`flex items-center justify-center rounded-full font-bold bg-surface ${dims} ${colors[grade]}`}
      dir="ltr"
    >
      {grade}
    </motion.div>
  );
}
