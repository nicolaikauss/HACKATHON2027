import { writeFileSync } from 'node:fs';
import { backtest, DEFAULT_CONFIG } from '../src/lib/forecast';

// Chain-level figures for the deck. The bakery on screen uses scripts/bakery.ts.

const COVERAGES = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6];
const started = Date.now();
const results = COVERAGES.map((c) => backtest(c));

const pct = (x: number) => `${(x * 100).toFixed(1).padStart(5)}%`;
console.log('coverage |  WAPE before → after  |  waste before → after  |  fill before → after');
for (const r of results) {
  console.log(
    `${pct(r.coverage)}   | ${pct(r.wapeBefore)} → ${pct(r.wapeAfter)}    | ${pct(r.wasteBefore)} → ${pct(r.wasteAfter)}     | ${pct(r.fillBefore)} → ${pct(r.fillAfter)}`,
  );
}
console.log(`\nper SKU at 40% coverage`);
for (const s of results[4].perSku) {
  console.log(`${s.sku.padEnd(8)} WAPE ${pct(s.wapeBefore)} → ${pct(s.wapeAfter)}  waste ${pct(s.wasteBefore)} → ${pct(s.wasteAfter)}  fill ${pct(s.fillBefore)} → ${pct(s.fillAfter)}`);
}

// How much of the gain depends on how good agents are at knowing tomorrow.
const sensitivity = [
  { label: 'pessimistic', foresight: 0.6, phantom: 0.15, conversion: 0.65 },
  { label: 'base', foresight: 0.85, phantom: 0.05, conversion: 0.82 },
  { label: 'optimistic', foresight: 0.95, phantom: 0.02, conversion: 0.9 },
].map((s) => {
  const { label, ...overrides } = s;
  const r = backtest(0.4, { ...DEFAULT_CONFIG, ...overrides });
  const bread = r.perSku.find((x) => x.sku === 'bread')!;
  return { ...s, result: r, bread };
});
console.log('\nsensitivity at 40% coverage');
for (const s of sensitivity) {
  console.log(
    `${s.label.padEnd(12)} all WAPE ${pct(s.result.wapeBefore)} → ${pct(s.result.wapeAfter)} | bread waste ${pct(s.bread.wasteBefore)} → ${pct(s.bread.wasteAfter)}, fill ${pct(s.bread.fillBefore)} → ${pct(s.bread.fillAfter)}`,
  );
}
console.log(`\n${Date.now() - started} ms`);

writeFileSync(
  'src/data/backtest.json',
  `${JSON.stringify({ config: DEFAULT_CONFIG, runs: 12, results, sensitivity }, null, 2)}\n`,
);
