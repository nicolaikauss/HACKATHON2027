// Backtest behind every forecast KPI in the pitch.
//
// Everything is synthetic and seeded: households, purchases, shocks. It answers one narrow
// question: if a share of households buy through agents holding signed intent, how much
// better can a store plan one day ahead, using only aggregated counts?
//
// "Before" is what a small grocer does today: the same weekday, averaged over 4 weeks.
// "Domani" adds aggregated intent, discounted by how often past intent actually became a
// completed payment. It never reads a household record: the forecast only receives the
// daily counts produced by simulateDemand.

export type Sku = {
  id: string;
  code: string;
  name: string;
  unit: string;
  /** Days between purchases for a typical household. */
  cycle: number;
  /** Share of households that buy this item at all. */
  buyers: number;
  /** Days an item can stay on the shelf. */
  shelfLife: number;
  /** How much rain lifts (or cuts) purchases. */
  rainLift: number;
};

export const SKUS: Sku[] = [
  { id: 'eggs', code: 'UOV', name: 'Uova extra fresche', unit: 'dozen', cycle: 11, buyers: 0.62, shelfLife: 5, rainLift: 0.04 },
  { id: 'bread', code: 'PAN', name: 'Pane fresco', unit: 'loaves', cycle: 3, buyers: 0.55, shelfLife: 1, rainLift: -0.08 },
  { id: 'milk', code: 'LAT', name: 'Latte fresco', unit: 'litres', cycle: 5, buyers: 0.58, shelfLife: 4, rainLift: 0.02 },
  { id: 'pasta', code: 'PAS', name: 'Pasta fresca', unit: 'packs', cycle: 14, buyers: 0.4, shelfLife: 3, rainLift: 0.12 },
  { id: 'greens', code: 'VER', name: 'Verdura a foglia', unit: 'bunches', cycle: 6, buyers: 0.48, shelfLife: 2, rainLift: -0.12 },
];

export type BacktestConfig = {
  seed: number;
  households: number;
  days: number;
  warmup: number;
  /** Share of households buying through an agent with a signed intent. */
  coverage: number;
  /** Probability that a delegated purchase is completed at this store rather than elsewhere. */
  conversion: number;
  /** Share of real needs an agent has already declared by the evening before. */
  foresight: number;
  /** Chance that an agent declares a purchase for a need that doesn't materialise. */
  phantom: number;
  /** Target probability of not running out. */
  service: number;
};

export const DEFAULT_CONFIG: Omit<BacktestConfig, 'coverage'> = {
  seed: 2028,
  households: 2400,
  days: 182,
  warmup: 56,
  conversion: 0.82,
  foresight: 0.85,
  phantom: 0.05,
  service: 0.95,
};

export type DayDemand = {
  /** Units sold to households with no agent. */
  organic: number;
  /** Units sold through agents, i.e. completed payments. */
  paidIntent: number;
  /** Units agents declared the evening before. */
  declaredIntent: number;
};

export type SkuResult = {
  sku: string;
  wapeBefore: number;
  wapeAfter: number;
  wasteBefore: number;
  wasteAfter: number;
  fillBefore: number;
  fillAfter: number;
};

export type BacktestResult = {
  coverage: number;
  wapeBefore: number;
  wapeAfter: number;
  wasteBefore: number;
  wasteAfter: number;
  fillBefore: number;
  fillAfter: number;
  perSku: SkuResult[];
};

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WEEKDAY = [0.8, 0.92, 0.95, 1.0, 1.12, 1.38, 0.83];

type Calendar = { rain: boolean[]; shock: number[] };

/** Rain days and demand shocks (strikes, festivals, viral recipes) a calendar average can't see. */
export function makeCalendar(rand: () => number, days: number): Calendar {
  const rain: boolean[] = [];
  const shock: number[] = [];
  let wet = false;
  let remaining = 0;
  let level = 1;
  for (let d = 0; d < days; d += 1) {
    wet = rand() < (wet ? 0.55 : 0.22);
    rain.push(wet);
    if (remaining === 0 && rand() < 0.06) {
      remaining = 1 + Math.floor(rand() * 3);
      level = rand() < 0.5 ? 0.62 + rand() * 0.18 : 1.25 + rand() * 0.4;
    }
    if (remaining > 0) {
      shock.push(level);
      remaining -= 1;
    } else {
      shock.push(1);
    }
  }
  return { rain, shock };
}

/** Household-level ground truth. Its output is aggregated per day before anything else sees it. */
export function simulateDemand(sku: Sku, config: BacktestConfig, calendar: Calendar, rand: () => number): DayDemand[] {
  const demand: DayDemand[] = Array.from({ length: config.days }, () => ({ organic: 0, paidIntent: 0, declaredIntent: 0 }));
  const buyers = Math.round(config.households * sku.buyers);

  for (let h = 0; h < buyers; h += 1) {
    const delegated = rand() < config.coverage;
    const cycle = sku.cycle * (0.7 + rand() * 0.6);
    let next = rand() * cycle;
    while (next < config.days) {
      const day = Math.floor(next);
      const weather = calendar.rain[day] ? 1 + sku.rainLift : 1;
      const pressure = WEEKDAY[day % 7] * calendar.shock[day] * weather;
      const needIsReal = rand() < Math.min(1, pressure * 0.72);
      if (!delegated) {
        if (needIsReal) demand[day].organic += 1;
      } else if (needIsReal) {
        // Agents don't foresee everything: some needs only surface on the day.
        if (rand() < config.foresight) demand[day].declaredIntent += 1;
        // Some agents end up buying elsewhere; only completed payments count as sales here.
        if (rand() < config.conversion) demand[day].paidIntent += 1;
      } else if (rand() < config.phantom) {
        // Intent that never turns into a real need.
        demand[day].declaredIntent += 1;
      }
      next += cycle * (0.8 + rand() * 0.4);
    }
  }
  return demand;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function sameWeekdayAverage(series: number[], day: number, weeks = 4): number {
  const sample: number[] = [];
  for (let w = 1; w <= weeks; w += 1) {
    const i = day - w * 7;
    if (i >= 0) sample.push(series[i]);
  }
  return mean(sample);
}

/** Today's method: same weekday, four-week average. */
export function forecastBefore(actuals: number[], day: number): number {
  return sameWeekdayAverage(actuals, day);
}

/** Domani: calibrated intent plus a weekday baseline for everyone with no agent. */
export function forecastDomani(demand: DayDemand[], day: number, lookback = 28): number {
  let paid = 0;
  let declared = 0;
  for (let d = Math.max(0, day - lookback); d < day; d += 1) {
    paid += demand[d].paidIntent;
    declared += demand[d].declaredIntent;
  }
  // Intent is cheap. Payment is proof: past payments set how much declared intent is worth.
  const calibration = declared > 0 ? paid / declared : 0;
  const organic = demand.map((d) => d.organic);
  return demand[day].declaredIntent * calibration + sameWeekdayAverage(organic, day);
}

type PlanOutcome = { wape: number; waste: number; fill: number };

/** Daily ordering with first-expired-first-out shelves and a buffer sized from recent errors. */
export function runPlan(
  sku: Sku,
  actuals: number[],
  forecasts: number[],
  warmup: number,
  service: number,
): PlanOutcome {
  const z = service >= 0.95 ? 1.645 : 1.28;
  let shelf: number[] = Array(sku.shelfLife).fill(0);
  let absError = 0;
  let sold = 0;
  let wasted = 0;
  let ordered = 0;
  let demanded = 0;
  const errors: number[] = [];

  for (let d = 0; d < actuals.length; d += 1) {
    const error = actuals[d] - forecasts[d];
    if (d >= warmup) {
      const recent = errors.slice(-28);
      const spread = Math.sqrt(mean(recent.map((e) => e * e)));
      const target = Math.max(0, forecasts[d] + z * spread);
      const onHand = shelf.reduce((a, b) => a + b, 0);
      const order = Math.max(0, Math.round(target - onHand));
      shelf[sku.shelfLife - 1] += order;

      let need = actuals[d];
      for (let age = 0; age < shelf.length && need > 0; age += 1) {
        const take = Math.min(shelf[age], need);
        shelf[age] -= take;
        need -= take;
        sold += take;
      }
      wasted += shelf[0];
      shelf = [...shelf.slice(1), 0];

      ordered += order;
      demanded += actuals[d];
      absError += Math.abs(error);
    }
    errors.push(error);
  }

  return {
    wape: demanded ? absError / demanded : 0,
    waste: ordered ? wasted / ordered : 0,
    fill: demanded ? sold / demanded : 0,
  };
}

export function backtestSku(sku: Sku, config: BacktestConfig, seedOffset: number): SkuResult {
  const rand = mulberry32(config.seed + seedOffset);
  const calendar = makeCalendar(rand, config.days);
  const demand = simulateDemand(sku, config, calendar, rand);
  const actuals = demand.map((d) => d.organic + d.paidIntent);
  const before = actuals.map((_, d) => forecastBefore(actuals, d));
  const after = actuals.map((_, d) => forecastDomani(demand, d));
  const a = runPlan(sku, actuals, before, config.warmup, config.service);
  const b = runPlan(sku, actuals, after, config.warmup, config.service);
  return {
    sku: sku.id,
    wapeBefore: a.wape,
    wapeAfter: b.wape,
    wasteBefore: a.waste,
    wasteAfter: b.waste,
    fillBefore: a.fill,
    fillAfter: b.fill,
  };
}

/** One neighbourhood shop. For bread, this is about 100 loaves a day. */
export const SHOP_CONFIG: Omit<BacktestConfig, 'coverage'> = { ...DEFAULT_CONFIG, households: 600 };
/** Goods for the single-shop examples. These spoil within a day or two, so a wrong order becomes waste. */
export const SHOP_SKUS: Sku[] = [
  SKUS.find((s) => s.id === 'bread')!,
  { id: 'pastries', code: 'BRI', name: 'Pastries', unit: 'pastries', cycle: 5, buyers: 0.45, shelfLife: 1, rainLift: -0.1 },
  { id: 'sandwiches', code: 'PAI', name: 'Sandwiches', unit: 'sandwiches', cycle: 3, buyers: 0.3, shelfLife: 1, rainLift: -0.14 },
  { id: 'fish', code: 'PES', name: 'Fresh fish', unit: 'portions', cycle: 8, buyers: 0.35, shelfLife: 1, rainLift: -0.05 },
  { id: 'flowers', code: 'FIO', name: 'Flowers', unit: 'bunches', cycle: 14, buyers: 0.25, shelfLife: 2, rainLift: -0.15 },
];
const skuById = (id: string) => SHOP_SKUS.find((s) => s.id === id)!;

export function shopWaste(skuId: string, coverage: number, runs = 24) {
  const sku = skuById(skuId);
  const samples = Array.from({ length: runs }, (_, r) => backtestSku(sku, { ...SHOP_CONFIG, coverage }, r * 37));
  return {
    wasteBefore: mean(samples.map((s) => s.wasteBefore)),
    wasteAfter: mean(samples.map((s) => s.wasteAfter)),
    fillBefore: mean(samples.map((s) => s.fillBefore)),
    fillAfter: mean(samples.map((s) => s.fillAfter)),
  };
}

export type ShopDay = { guess: number; lists: number; walkIn: number; total: number };

/** Tomorrow's numbers for one shop and one product. `rain` is the chance of rain from 0 to 1. */
export function shopTomorrow(skuId: string, coverage: number, weekday: number, rain: number): ShopDay {
  const sku = skuById(skuId);
  const config = { ...SHOP_CONFIG, coverage, days: 170 };
  const rand = mulberry32(config.seed + 11);
  const demand = simulateDemand(sku, config, makeCalendar(rand, config.days), rand);
  const actuals = demand.map((d) => d.organic + d.paidIntent);
  const t = 141 + weekday;
  const buffer = (forecast: (d: number) => number) => {
    const errors = Array.from({ length: 28 }, (_, i) => actuals[t - 28 + i] - forecast(t - 28 + i));
    return 1.645 * Math.sqrt(mean(errors.map((e) => e * e)));
  };
  const before = (d: number) => forecastBefore(actuals, d);
  const after = (d: number) => forecastDomani(demand, d);
  let paid = 0;
  let declared = 0;
  for (let d = t - 28; d < t; d += 1) {
    paid += demand[d].paidIntent;
    declared += demand[d].declaredIntent;
  }
  const lists = Math.round(demand[t].declaredIntent * (declared ? paid / declared : 0));
  const total = Math.round(after(t) + buffer(after) + sku.rainLift * rain * (after(t) - lists));
  return { guess: Math.round(before(t) + buffer(before)), lists, walkIn: total - lists, total };
}

export function backtest(coverage: number, base = DEFAULT_CONFIG, runs = 12): BacktestResult {
  const config = { ...base, coverage };
  const rows: SkuResult[] = SKUS.map((sku, i) => {
    const samples = Array.from({ length: runs }, (_, r) => backtestSku(sku, config, i * 1000 + r * 37));
    const avg = (key: keyof Omit<SkuResult, 'sku'>) => mean(samples.map((s) => s[key]));
    return {
      sku: sku.id,
      wapeBefore: avg('wapeBefore'),
      wapeAfter: avg('wapeAfter'),
      wasteBefore: avg('wasteBefore'),
      wasteAfter: avg('wasteAfter'),
      fillBefore: avg('fillBefore'),
      fillAfter: avg('fillAfter'),
    };
  });
  const across = (key: keyof Omit<SkuResult, 'sku'>) => mean(rows.map((r) => r[key]));
  return {
    coverage,
    wapeBefore: across('wapeBefore'),
    wapeAfter: across('wapeAfter'),
    wasteBefore: across('wasteBefore'),
    wasteAfter: across('wasteAfter'),
    fillBefore: across('fillBefore'),
    fillAfter: across('fillAfter'),
    perSku: rows,
  };
}
