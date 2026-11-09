// Renders public/icons/icon.svg to the PNG sizes the PWA manifest needs.
// Usage: npm run icons   (requires Playwright + Chromium available)
import { createRequire } from 'node:module';
// CJS require honours NODE_PATH, so a globally installed Playwright works too.
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync } from 'node:fs';

const dir = new URL('../public/icons/', import.meta.url).pathname;
const svg = readFileSync(dir + 'icon.svg', 'utf8').replace('<svg ', '<svg width="100%" height="100%" ');
const targets = [
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['icon-maskable-512.png', 512, 0.1],
  ['apple-touch-icon.png', 180, 0],
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, pad] of targets) {
  const inner = Math.round(size * (1 - pad * 2));
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<body style="margin:0;background:#0B0E11;display:grid;place-items:center;width:${size}px;height:${size}px"><div style="width:${inner}px;height:${inner}px">${svg}</div></body>`,
  );
  await page.screenshot({ path: dir + name });
}
await browser.close();
