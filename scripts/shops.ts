import { writeFileSync } from 'node:fs';
import { SHOP_CONFIG, SHOP_SKUS, shopTomorrow, shopWaste } from '../src/lib/forecast';

const COVERAGE = 0.4;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const rows = SHOP_SKUS.map((sku) => ({ sku: sku.id, ...shopWaste(sku.id, COVERAGE) }));
for (const r of rows) {
  console.log(`${r.sku.padEnd(11)} waste ${pct(r.wasteBefore)} to ${pct(r.wasteAfter)}, served ${pct(r.fillBefore)} to ${pct(r.fillAfter)}, Friday`, shopTomorrow(r.sku, COVERAGE, 3, 0.6));
}
writeFileSync('src/data/shops.json', `${JSON.stringify({ households: SHOP_CONFIG.households, coverage: COVERAGE, runs: 24, rows }, null, 2)}\n`);
