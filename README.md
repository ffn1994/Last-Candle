# Last Candle — الشمعة الأخيرة

A mobile-first trading-survival game. The goal is **not** profit. The goal is to **survive with discipline**.
You trade a hidden historical market scenario candle by candle, and the name is revealed only at the end.

Arabic UI, full RTL. The chart stays LTR.

## Commands

```bash
npm install
npm run dev       # dev server, exposed on your LAN (--host) so you can open it on your phone
npm test          # Vitest: engine, nerves, sizing, grading, scenarios
npm run build     # type-check + production build + service worker
npm run preview   # serve the production build (PWA/offline works here, not in dev)
npm run icons     # re-render PNG icons from public/icons/icon.svg (needs Playwright)
```

Deploy: import the repo in Vercel. Vite is auto-detected (build `npm run build`, output `dist`).

## Structure

```
src/
  game/        pure engine (no React): engine.ts, nerves.ts, scoring.ts, lessons.ts, rng.ts, types.ts
  data/        scenarios.ts: seeded regime-segment generators (swap for real OHLC later)
  components/  Button, BottomSheet, Modal, NervesBar, CandleChart, TradeSheet, NewsCard, GradeBadge, ...
  screens/     Splash, Tutorial, Menu, ModeSelect, Briefing, Game, End, History, Settings
  i18n/ar.ts   every Arabic string
  store.ts     zustand + persist (settings, unlocks, history, in-progress round)
```

Saved rounds store only `(scenarioId, seed)`. Candles are regenerated deterministically on resume.
