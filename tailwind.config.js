/** @type {import('tailwindcss').Config} */
// Tailwind v3 on purpose: v4 emits CSS cascade layers (@layer), which browsers
// older than Chrome 99 / Safari 15.4 ignore entirely (most smart TVs, older iPads).
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0B0E11',
        surface: '#151A21',
        'surface-2': '#1E242C',
        border: '#2A313B',
        text: '#EAECEF',
        muted: '#848E9C',
        up: '#16C784',
        down: '#EA3943',
        gold: '#F0B90B',
      },
      borderColor: { DEFAULT: '#2A313B' },
      fontFamily: { sans: ['"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'] },
      screens: {
        // short landscape screens (phones on their side): compact the vertical layout
        short: { raw: '(max-height: 520px)' },
      },
    },
  },
  plugins: [],
};
