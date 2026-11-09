// Snapshots the free, keyless public APIs the prototype reads.
// The app re-fetches the CORS-enabled ones live; this file is the offline fallback
// and the frozen data the video renders from.
import { writeFile, mkdir } from 'node:fs/promises';

const UA = { 'User-Agent': 'nexi-domani-hackathon/1.0' };

async function json(url) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function attempt(label, fn) {
  try {
    const value = await fn();
    console.log(`ok   ${label}`);
    return value;
  } catch (err) {
    console.log(`FAIL ${label}: ${err.message}`);
    return null;
  }
}

function lastEurostatValue(data) {
  const times = Object.entries(data.dimension.time.category.index).sort((a, b) => a[1] - b[1]);
  for (let i = times.length - 1; i >= 0; i -= 1) {
    const value = data.value[String(i)];
    if (value !== undefined) return { period: times[i][0], value };
  }
  return null;
}

const weather = await attempt('open-meteo', async () => {
  const d = await json(
    'https://api.open-meteo.com/v1/forecast?latitude=45.07&longitude=7.69&daily=temperature_2m_max,precipitation_probability_max&timezone=Europe%2FRome&forecast_days=7',
  );
  return d.daily.time.map((date, i) => ({
    date,
    tempMax: d.daily.temperature_2m_max[i],
    rainProb: d.daily.precipitation_probability_max[i],
  }));
});

const holidays = await attempt('nager.date', async () => {
  const [a, b] = await Promise.all([
    json('https://date.nager.at/api/v3/PublicHolidays/2026/IT'),
    json('https://date.nager.at/api/v3/PublicHolidays/2027/IT'),
  ]);
  return [...a, ...b].map((h) => ({ date: h.date, name: h.localName }));
});

const eggPrices = await attempt('eurostat eggs HICP', async () => {
  const d = await json(
    'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_manr?format=JSON&lang=EN&geo=IT&coicop=CP01147&sinceTimePeriod=2025-06',
  );
  return lastEurostatValue(d);
});

const foodWaste = await attempt('eurostat food waste', async () => {
  const d = await json(
    'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/env_wasfw?format=JSON&lang=EN&geo=EU27_2020&unit=T&sinceTimePeriod=2023',
  );
  const naceIndex = d.dimension.nace_r2.category.index;
  const timeIndex = d.dimension.time.category.index;
  const year = Object.keys(timeIndex).sort().at(-1);
  const naceCount = Object.keys(naceIndex).length;
  const at = (nace) => d.value[String(naceIndex[nace] * Object.keys(timeIndex).length + timeIndex[year])];
  return { year, naceCount, totalT: at('TOT'), retailT: at('G46_G47_FOOD'), householdsT: at('HH') };
});

const eggs = await attempt('open food facts', async () => {
  const base = 'https://world.openfoodfacts.org/api/v2/search';
  const q = '?categories_tags_en=eggs&countries_tags_en=italy&fields=code,product_name,brands,labels_tags&page_size=24';
  const d = await json(base + q);
  return d.products
    .filter((p) => p.product_name && p.brands)
    .map((p) => ({ code: p.code, name: p.product_name, brand: p.brands, labels: p.labels_tags ?? [] }));
});

await mkdir('src/data', { recursive: true });
await writeFile(
  'src/data/signals.json',
  `${JSON.stringify({ fetchedAt: new Date().toISOString(), weather, holidays, eggPrices, foodWaste, eggs }, null, 2)}\n`,
);
console.log('wrote src/data/signals.json');
