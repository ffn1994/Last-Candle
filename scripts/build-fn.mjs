// Bundle the submit-daily edge function with the game's own engine.
// The historical markets (and their data file) are never part of the daily
// challenge, so they are replaced by an empty stub to keep the bundle small.
import { build } from 'esbuild';

const stubHistorical = {
  name: 'stub-historical',
  setup(b) {
    b.onResolve({ filter: /\/historical$/ }, () => ({ path: 'historical-stub', namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
      contents: 'export const HISTORICAL = []; export const isHistoricalId = () => false; export const historicalMonths = () => null; export const monthStart = () => 0; export const monthEnd = () => 0;',
      loader: 'js',
    }));
  },
};

await build({
  entryPoints: ['supabase/functions/submit-daily/index.ts'],
  outfile: 'supabase/functions/submit-daily/dist/index.js',
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  minify: true,
  external: ['npm:*'],
  plugins: [stubHistorical],
});
console.log('built supabase/functions/submit-daily/dist/index.js');
