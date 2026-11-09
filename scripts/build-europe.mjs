// Turns Europe (Natural Earth, via world-atlas) into a dot grid, and joins Eurostat food waste per person.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { feature } from 'topojson-client';

const COUNTRIES = {
  BE: 'Belgium', BG: 'Bulgaria', CZ: 'Czechia', DK: 'Denmark', DE: 'Germany', EE: 'Estonia', IE: 'Ireland', EL: 'Greece',
  ES: 'Spain', FR: 'France', HR: 'Croatia', IT: 'Italy', CY: 'Cyprus', LV: 'Latvia', LT: 'Lithuania', LU: 'Luxembourg',
  HU: 'Hungary', MT: 'Malta', NL: 'Netherlands', AT: 'Austria', PL: 'Poland', PT: 'Portugal', RO: 'Romania', SI: 'Slovenia',
  SK: 'Slovakia', FI: 'Finland', SE: 'Sweden', NO: 'Norway',
};
const NOT_EUROPE = new Set(['Russia', 'Turkey', 'Morocco', 'Algeria', 'Tunisia', 'Libya', 'Egypt', 'Israel', 'Palestine', 'Lebanon', 'Syria', 'Jordan', 'Iraq', 'Georgia', 'Armenia', 'Azerbaijan', 'Kazakhstan', 'Iran', 'W. Sahara']);

const url = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/env_wasfw?format=JSON&lang=EN&unit=KG_HAB&nace_r2=TOT';
const stat = await (await fetch(url)).json();
const geoIndex = stat.dimension.geo.category.index;
const timeIndex = stat.dimension.time.category.index;
const geoAt = stat.id.indexOf('geo');
const timeAt = stat.id.indexOf('time');
const stride = (at) => stat.size.slice(at + 1).reduce((a, b) => a * b, 1);
const latest = (code) => {
  for (const year of Object.keys(timeIndex).sort().reverse()) {
    const value = stat.value[String(geoIndex[code] * stride(geoAt) + timeIndex[year] * stride(timeAt))];
    if (value !== undefined && value !== null) return { kg: Math.round(value), year: Number(year) };
  }
  return null;
};

const topo = JSON.parse(await readFile('node_modules/world-atlas/countries-50m.json', 'utf8'));
const WIDTH = 920;
const LON = [-11, 35];
const LAT = [35, 71];
const K = Math.cos(53 * (Math.PI / 180));
const scale = WIDTH / (LON[1] - LON[0]);
const HEIGHT = Math.round(((LAT[1] - LAT[0]) * scale) / K);
const STEP = 10;

const shapes = feature(topo, topo.objects.countries).features
  .filter((f) => !NOT_EUROPE.has(f.properties.name))
  .map((f) => {
    const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    const points = polygons.flat(2);
    const lons = points.map((p) => p[0]);
    const lats = points.map((p) => p[1]);
    return { name: f.properties.name, polygons, box: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)] };
  })
  .filter((s) => s.box[0] < LON[1] && s.box[2] > LON[0] && s.box[1] < LAT[1] && s.box[3] > LAT[0]);

const inRing = (lon, lat, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const shapeAt = (lon, lat) =>
  shapes.find((s) => lon >= s.box[0] && lon <= s.box[2] && lat >= s.box[1] && lat <= s.box[3]
    && s.polygons.some(([outer, ...holes]) => inRing(lon, lat, outer) && !holes.some((h) => inRing(lon, lat, h))));

const codes = Object.keys(COUNTRIES);
const nameToIndex = new Map(codes.map((code, i) => [COUNTRIES[code], i]));
const noise = (x, y) => {
  const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

const dots = [];
let row = 0;
for (let y = STEP / 2; y < HEIGHT; y += STEP * 0.866, row += 1) {
  for (let x = (row % 2 ? STEP / 2 : 0) + STEP / 2; x < WIDTH; x += STEP) {
    const lon = x / scale + LON[0];
    const lat = LAT[1] - y / (scale / K);
    const shape = shapeAt(lon, lat);
    if (!shape) continue;
    const index = nameToIndex.get(shape.name) ?? -1;
    // Dissolve the eastern edge of the countries with no data, so the map does not end in a hard line.
    if (index < 0 && lon > 27 && noise(x, y) < (lon - 27) / 6) continue;
    dots.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10, index]);
  }
}

const countries = codes.map((id, i) => {
  const own = dots.filter((d) => d[2] === i);
  const figure = latest(id);
  if (!own.length || !figure) return { id, name: COUNTRIES[id], kg: null, year: null, x: 0, y: 0, dots: 0 };
  return {
    id, name: COUNTRIES[id], ...figure,
    x: Math.round(own.reduce((a, d) => a + d[0], 0) / own.length),
    y: Math.round(own.reduce((a, d) => a + d[1], 0) / own.length),
    dots: own.length,
  };
});

await writeFile('src/data/europe.json', JSON.stringify({
  fetchedAt: new Date().toISOString().slice(0, 10),
  width: WIDTH, height: HEIGHT, step: STEP, dots, countries,
}));
console.log(`${dots.length} dots, ${WIDTH}x${HEIGHT}`);

// Finer grids for the zoom. All coordinates stay in the Europe map's units.
const toX = (lon) => (lon - LON[0]) * scale;
const toY = (lat) => (LAT[1] - lat) * (scale / K);
const fromX = (x) => x / scale + LON[0];
const fromY = (y) => LAT[1] - y / (scale / K);

function landGrid([west, east], [south, north], step) {
  const flat = [];
  let r = 0;
  for (let y = toY(north); y < toY(south); y += step * 0.866, r += 1) {
    for (let x = toX(west) + (r % 2 ? step / 2 : 0); x < toX(east); x += step) {
      const shape = shapeAt(fromX(x), fromY(y));
      if (shape) flat.push(Math.round(x * 100) / 100, Math.round(y * 100) / 100, shape.name === 'Italy' ? 1 : 0);
    }
  }
  return flat;
}

const CACHE = 'out/turin-osm.json';
async function turinStreets() {
  try {
    return JSON.parse(await readFile(CACHE, 'utf8'));
  } catch { /* not fetched yet */ }
  const query = '[out:json][timeout:50];(way["highway"~"^(motorway|trunk|primary|secondary|tertiary)$"](44.97,7.50,45.17,7.85);way["waterway"="river"](44.97,7.50,45.17,7.85););out geom;';
  const hosts = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass-api.de/api/interpreter'];
  for (const [i, host] of hosts.entries()) {
    await new Promise((r) => setTimeout(r, i * 12000));
    const res = await fetch(host, { method: 'POST', body: new URLSearchParams({ data: query }), headers: { 'User-Agent': 'nexi-hackathon-prototype' } }).catch(() => null);
    if (!res?.ok) { console.log(`street data: ${host} failed (${res?.status})`); continue; }
    const text = await res.text();
    await mkdir('out', { recursive: true });
    await writeFile(CACHE, text);
    return JSON.parse(text);
  }
  throw new Error('No street data. Try again later.');
}

const streets = await turinStreets();
const T_STEP = 0.09;
const T_W = [toX(7.5), toX(7.85)];
const T_H = [toY(45.17), toY(44.97)];
const ROW = T_STEP * 0.866;
const cols = Math.ceil((T_W[1] - T_W[0]) / T_STEP);
const rows = Math.ceil((T_H[1] - T_H[0]) / ROW);
const cells = new Uint8Array(cols * rows);
const mark = (x, y, value, reach) => {
  const row = Math.round((y - T_H[0]) / ROW);
  const col = Math.round((x - T_W[0]) / T_STEP);
  for (let a = -reach; a <= reach; a += 1) {
    for (let b = -reach; b <= reach; b += 1) {
      const c = col + a;
      const d = row + b;
      if (c < 0 || d < 0 || c >= cols || d >= rows) continue;
      const at = d * cols + c;
      if (value === 3 || cells[at] !== 3) cells[at] = Math.max(cells[at], value);
    }
  }
};
for (const way of streets.elements) {
  if (!way.geometry || way.tags?.highway === 'tertiary') continue;
  const river = Boolean(way.tags?.waterway);
  const major = /motorway|trunk|primary/.test(way.tags?.highway ?? '');
  for (let i = 1; i < way.geometry.length; i += 1) {
    const a = way.geometry[i - 1];
    const b = way.geometry[i];
    const [x0, y0, x1, y1] = [toX(a.lon), toY(a.lat), toX(b.lon), toY(b.lat)];
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (T_STEP / 2));
    for (let s = 0; s <= n; s += 1) mark(x0 + ((x1 - x0) * s) / n, y0 + ((y1 - y0) * s) / n, river ? 3 : major ? 2 : 1, river ? 1 : 0);
  }
}
const tx = toX(7.68);
const ty = toY(45.07);
const turin = [];
for (let d = 0; d < rows; d += 1) {
  for (let c = 0; c < cols; c += 1) {
    const x = T_W[0] + (c + (d % 2 ? 0.5 : 0)) * T_STEP;
    const y = T_H[0] + d * ROW;
    const far = Math.hypot(x - tx, y - ty) / 3.4;
    if (far > 1 || noise(x, y) < far ** 3) continue;
    turin.push(Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000, cells[d * cols + c]);
  }
}

const italy = landGrid([5, 20], [36, 48], 3.2);
const region = landGrid([6.3, 9.8], [43.8, 46.6], 0.8);
await writeFile('src/data/zoom.json', JSON.stringify({ italy, region, turin }));
console.log(`italy ${italy.length / 3}, region ${region.length / 3}, turin ${turin.length / 3}`);
