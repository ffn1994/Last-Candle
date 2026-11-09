import { motion } from 'framer-motion';

/** The gold candle, also a candlestick: body + wicks, with a flickering flame. */
export function Flame({ size = 120, lit = true }: { size?: number; lit?: boolean }) {
  return (
    <svg width={size} height={size * 1.5} viewBox="0 0 80 120" aria-hidden>
      <defs>
        <radialGradient id="fl-glow" cx="50%" cy="30%" r="50%">
          <stop offset="0%" stopColor="#F0B90B" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#F0B90B" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="fl-flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#E07A00" />
          <stop offset="55%" stopColor="#F0B90B" />
          <stop offset="100%" stopColor="#FFF3C4" />
        </linearGradient>
      </defs>
      {lit && (
        <motion.circle
          cx="40" cy="30" r="40" fill="url(#fl-glow)"
          initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: [0.7, 1, 0.8], scale: 1 }}
          transition={{ duration: 1.2, opacity: { repeat: Infinity, repeatType: 'mirror', duration: 1.4 } }}
          style={{ transformOrigin: '40px 30px' }}
        />
      )}
      {lit && (
        <motion.path
          d="M40 8 C52 22 52 34 40 44 C28 34 28 22 40 8 Z"
          fill="url(#fl-flame)"
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: [1, 1.08, 0.96, 1], opacity: 1, rotate: [0, 1.5, -1.5, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: '40px 44px' }}
        />
      )}
      <rect x="38.5" y="42" width="3" height="10" fill="#3A2E10" />
      <rect x="37" y="50" width="6" height="8" fill="#F0B90B" />
      <rect x="25" y="58" width="30" height="44" rx="3" fill="#F0B90B" />
      <rect x="37" y="102" width="6" height="10" fill="#F0B90B" />
    </svg>
  );
}
