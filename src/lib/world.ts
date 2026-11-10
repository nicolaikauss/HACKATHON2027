// The Nexi demo world: customers, a merchant and a supplier share one state.
// Every payment on both hops goes through the same mandate rules in guard.ts.
import { decide, issueToken, type Mandate, type Purchase, type RuleId } from './guard';

export const MIN_GROUP = 50;
export const POOL = 240;
const MAX_LIVE = 40;
const LOG_CAP = 60;

export type Market = {
  id: string; label: string; shop: string; area: string; noun: string; unit: string; day: string;
  baseCents: number; stepCents: number; capacity: number; maxQty: number;
  supplier: string; input: string; inputUnit: string; inputNoun: string; perUnit: number; inputCents: number; inputStep: number;
  lon: number; lat: number; side: 'left' | 'right';
};

export const MARKETS: Market[] = [
  { id: 'bread', label: 'Bread', shop: 'Bakery', area: 'San Salvario', noun: 'loaf', unit: 'loaves', day: 'Friday', baseCents: 280, stepCents: 20, capacity: 350, maxQty: 3, supplier: 'Mill', input: 'flour', inputUnit: 'kg', inputNoun: 'kg', perUnit: 0.5, inputCents: 90, inputStep: 10, lon: 7.6835, lat: 45.0535, side: 'right' },
  { id: 'pastries', label: 'Pastries', shop: 'Pastry shop', area: 'Centro', noun: 'pastry', unit: 'pastries', day: 'Saturday', baseCents: 190, stepCents: 10, capacity: 420, maxQty: 4, supplier: 'Dairy', input: 'butter', inputUnit: 'kg', inputNoun: 'kg', perUnit: 0.03, inputCents: 900, inputStep: 50, lon: 7.683, lat: 45.07, side: 'left' },
  { id: 'sandwiches', label: 'Sandwiches', shop: 'Lunch bar', area: 'Crocetta', noun: 'sandwich', unit: 'sandwiches', day: 'Monday', baseCents: 650, stepCents: 50, capacity: 260, maxQty: 2, supplier: 'Roll bakery', input: 'rolls', inputUnit: 'rolls', inputNoun: 'roll', perUnit: 1, inputCents: 40, inputStep: 5, lon: 7.662, lat: 45.056, side: 'left' },
  { id: 'fish', label: 'Fresh fish', shop: 'Fish stall', area: 'Porta Palazzo', noun: 'portion', unit: 'portions', day: 'Friday', baseCents: 1200, stepCents: 100, capacity: 200, maxQty: 2, supplier: 'Fish market', input: 'fish', inputUnit: 'kg', inputNoun: 'kg', perUnit: 0.25, inputCents: 1800, inputStep: 100, lon: 7.6815, lat: 45.0775, side: 'left' },
  { id: 'flowers', label: 'Flowers', shop: 'Florist', area: 'Vanchiglia', noun: 'bunch', unit: 'bunches', day: 'Saturday', baseCents: 1500, stepCents: 100, capacity: 180, maxQty: 2, supplier: 'Grower', input: 'flowers', inputUnit: 'stems', inputNoun: 'stem', perUnit: 10, inputCents: 55, inputStep: 5, lon: 7.7, lat: 45.072, side: 'right' },
];
export const marketOf = (id: string) => MARKETS.find((m) => m.id === id) ?? MARKETS[0];

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

type Seed = { qty: number; maxCents: number; weeklyCents: number; allowed: boolean };
const pools = new Map<string, Seed[]>();

/** The same market always gives the same 240 customers. The first ten have names. */
function pool(m: Market): Seed[] {
  let list = pools.get(m.id);
  if (!list) {
    const rand = mulberry32([...m.id].reduce((a, c) => a * 31 + c.charCodeAt(0), 2028));
    const half = m.stepCents / 2;
    list = Array.from({ length: POOL }, () => {
      const qty = 1 + Math.floor(rand() * m.maxQty);
      const maxCents = Math.round((m.baseCents * (0.7 + 0.65 * rand())) / half) * half;
      const weeklyCents = m.baseCents * (qty + 1 + Math.floor(rand() * 4));
      return { qty, maxCents, weeklyCents, allowed: rand() < 0.9 };
    });
    pools.set(m.id, list);
  }
  return list;
}

export const NAMES = ['Luca', 'Giulia', 'Marco', 'Sara', 'Elena', 'Paolo', 'Chiara', 'Davide', 'Anna', 'Matteo'];
const crowd = (m: Market) => pool(m).slice(NAMES.length);
const seedMandate = (s: Seed, m: Market): Mandate => ({ revoked: false, limitCents: s.maxCents, weeklyCents: s.weeklyCents, shops: s.allowed ? [m.shop] : [], askAboveCents: null, hoursOnly: false });

function agentKey(name: string) {
  let h = 7;
  for (const ch of name) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  return `${name.slice(0, 2).toUpperCase()}-${(h % 65536).toString(16).toUpperCase().padStart(4, '0')}`;
}

export type Person = { id: string; name: string; live: boolean; qty: number; mandate: Mandate; spentCents: number; agent: string };
export type Offer = { priceCents: number; capacity: number };
export type Outcome = 'paid' | 'stopped' | 'ask' | 'declined';
export type Rule = RuleId | 'soldout';

/** One decision. The audit log keeps every one, with the rule that made it. */
export type Entry = {
  n: number; round: number; hop: 'shop' | 'supply' | 'test'; who: string; name: string; agent: string; what: string;
  qty: number; unitCents: number; totalCents: number; outcome: Outcome; rule: Rule; ruleName: string; reason: string; token: string | null;
};

export type MarketState = {
  round: number;
  people: Person[];
  offer: Offer | null;
  attempts: Record<string, Entry>;
  supply: Entry | null;
  history: (Offer & { peopleUnits: number })[];
  inputCents: number;
  merchant: { mandate: Mandate; spentCents: number };
  log: Entry[];
};
export type World = { seq: number; market: string; markets: Record<string, MarketState> };

export type RulesPatch = { qty?: number; limitCents?: number; weeklyCents?: number; askAboveCents?: number | null; allowShop?: boolean; hoursOnly?: boolean; revoked?: boolean };
export type TestKind = 'fake' | 'shop' | 'price' | 'night';
export type Action =
  | { type: 'reset' }
  | { type: 'market'; id: string }
  | { type: 'join'; id: string; name: string }
  | { type: 'rules'; who: string; patch: RulesPatch }
  | { type: 'answer'; who: string; approve: boolean }
  | { type: 'offer'; priceCents: number; capacity: number }
  | { type: 'merchantRules'; limitCents: number }
  | { type: 'inputPrice'; cents: number }
  | { type: 'close' }
  | { type: 'test'; who: string; kind: TestKind };

export const inputNeed = (m: Market, capacity: number) => Math.ceil(capacity * m.perUnit);
const firstMandate = (m: Market): Mandate => ({ revoked: false, limitCents: m.baseCents, weeklyCents: m.baseCents * 6, shops: [m.shop], askAboveCents: null, hoursOnly: true });

function firstState(m: Market): MarketState {
  return {
    round: 1,
    people: NAMES.map((name, i) => {
      const s = pool(m)[i];
      return { id: `p${i}`, name, live: false, qty: s.qty, agent: agentKey(name), spentCents: 0, mandate: { ...seedMandate(s, m), hoursOnly: true, askAboveCents: i === 1 ? m.baseCents : null } };
    }),
    offer: null, attempts: {}, supply: null, history: [], inputCents: m.inputCents, log: [],
    merchant: { spentCents: 0, mandate: { revoked: false, limitCents: m.inputCents + 2 * m.inputStep, weeklyCents: inputNeed(m, m.capacity) * m.inputCents * 5, shops: [m.supplier], askAboveCents: null, hoursOnly: false } },
  };
}

export const initialWorld = (): World => ({ seq: 0, market: MARKETS[0].id, markets: Object.fromEntries(MARKETS.map((m) => [m.id, firstState(m)])) });

const num = (v: unknown, lo: number, hi: number, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.min(hi, Math.max(lo, v))) : fallback);
const NOON: Pick<Purchase, 'signed' | 'hour' | 'weekday'> = { signed: true, hour: 12, weekday: true };
export const plural = (n: number, m: Market) => `${n} ${n === 1 ? m.noun : m.unit}`;
const paidUnits = (ms: MarketState) => Object.values(ms.attempts).reduce((a, e) => a + (e.outcome === 'paid' ? e.qty : 0), 0);

function record(ms: MarketState, entry: Entry) {
  ms.log.push(entry);
  if (ms.log.length > LOG_CAP) ms.log.splice(0, ms.log.length - LOG_CAP);
}

/** The agent of one person answers the live offer. A paid or declined attempt is final for the day. */
function evaluate(seq: number, ms: MarketState, m: Market, p: Person, approved = false) {
  const prev = ms.attempts[p.id];
  if (!ms.offer || prev?.outcome === 'paid' || prev?.outcome === 'declined') return;
  const units = Math.min(p.qty, ms.offer.capacity - paidUnits(ms));
  const qty = Math.max(units, 1);
  const d = decide(p.mandate, { shop: m.shop, cents: ms.offer.priceCents, qty, ...NOON }, p.spentCents, approved);
  const soldOut = d.outcome === 'paid' && units <= 0;
  const entry: Entry = {
    n: seq, round: ms.round, hop: 'shop', who: p.id, name: p.name, agent: p.agent, what: `${plural(qty, m)} at the ${m.shop.toLowerCase()}`,
    qty, unitCents: ms.offer.priceCents, totalCents: qty * ms.offer.priceCents,
    outcome: soldOut ? 'stopped' : d.outcome, rule: soldOut ? 'soldout' : d.rule,
    ruleName: soldOut ? 'Sold out' : d.ruleName, reason: soldOut ? 'The shop sold out before your agent could buy.' : d.reason, token: null,
  };
  if (entry.outcome === 'paid') {
    p.spentCents += entry.totalCents;
    entry.token = issueToken(m.shop, entry.totalCents, `${seq}:${p.id}`);
  }
  ms.attempts[p.id] = entry;
  if (!prev || prev.outcome !== entry.outcome || prev.rule !== entry.rule) record(ms, entry);
}

export const TESTS: Record<TestKind, { label: string; what: string; change: (p: Purchase) => Purchase }> = {
  fake: { label: 'A fake agent', what: 'Test: an unsigned agent tries to pay', change: (p) => ({ ...p, signed: false }) },
  shop: { label: 'An unknown shop', what: 'Test: a payment to an unknown web shop', change: (p) => ({ ...p, shop: 'Unknown web shop' }) },
  price: { label: 'A price 10× higher', what: 'Test: the price is ten times higher', change: (p) => ({ ...p, cents: p.cents * 10 }) },
  night: { label: 'Sunday, 03:00', what: 'Test: a payment on Sunday at 03:00', change: (p) => ({ ...p, hour: 3, weekday: false }) },
};

/** Applies one action. Unknown or broken actions change nothing, because actions can come from the network. */
export function reduce(world: World, action: unknown): World {
  const a = action as Action;
  if (!a || typeof a !== 'object' || typeof a.type !== 'string') return world;
  if (a.type === 'reset') return initialWorld();
  if (a.type === 'market') return MARKETS.some((m) => m.id === a.id) ? { ...world, market: a.id } : world;

  const seq = world.seq + 1;
  if (a.type === 'join') {
    const name = typeof a.name === 'string' ? a.name.trim().slice(0, 14) : '';
    const id = typeof a.id === 'string' ? a.id.slice(0, 24) : '';
    const first = world.markets[MARKETS[0].id];
    if (!name || !id || first.people.some((p) => p.id === id) || first.people.filter((p) => p.live).length >= MAX_LIVE) return world;
    const markets = Object.fromEntries(MARKETS.map((m) => {
      const ms = structuredClone(world.markets[m.id]);
      const p: Person = { id, name, live: true, qty: 1, agent: agentKey(name + id), spentCents: 0, mandate: firstMandate(m) };
      ms.people.push(p);
      evaluate(seq, ms, m, p);
      return [m.id, ms];
    }));
    return { ...world, seq, markets };
  }

  const m = marketOf(world.market);
  const ms = structuredClone(world.markets[m.id]);
  const next: World = { ...world, seq, markets: { ...world.markets, [m.id]: ms } };
  const person = 'who' in a ? ms.people.find((p) => p.id === a.who) : undefined;

  switch (a.type) {
    case 'rules': {
      const k = a.patch;
      if (!person || !k || typeof k !== 'object') return world;
      const r = person.mandate;
      if ('qty' in k) person.qty = num(k.qty, 1, m.maxQty, person.qty);
      if ('limitCents' in k) r.limitCents = num(k.limitCents, m.stepCents / 2, m.baseCents * 4, r.limitCents);
      if ('weeklyCents' in k) r.weeklyCents = num(k.weeklyCents, 0, m.baseCents * 100, r.weeklyCents);
      if ('askAboveCents' in k) r.askAboveCents = k.askAboveCents === null ? null : num(k.askAboveCents, 0, m.baseCents * 20, r.askAboveCents ?? m.baseCents);
      if (typeof k.allowShop === 'boolean') r.shops = k.allowShop ? [m.shop] : [];
      if (typeof k.hoursOnly === 'boolean') r.hoursOnly = k.hoursOnly;
      if (typeof k.revoked === 'boolean') r.revoked = k.revoked;
      evaluate(seq, ms, m, person);
      return next;
    }
    case 'answer': {
      const open = person && ms.attempts[person.id];
      if (!person || open?.outcome !== 'ask') return world;
      if (a.approve === true) evaluate(seq, ms, m, person, true);
      else {
        ms.attempts[person.id] = { ...open, n: seq, outcome: 'declined', ruleName: 'You said no', reason: 'You did not approve this payment.' };
        record(ms, ms.attempts[person.id]);
      }
      return next;
    }
    case 'offer': {
      if (ms.offer) return world;
      const offer: Offer = { priceCents: num(a.priceCents, m.stepCents, m.baseCents * 4, m.baseCents), capacity: num(a.capacity, 1, 5000, m.capacity) };
      const need = inputNeed(m, offer.capacity);
      const d = decide(ms.merchant.mandate, { shop: m.supplier, cents: ms.inputCents, qty: need, ...NOON }, ms.merchant.spentCents);
      const total = need * ms.inputCents;
      const paid = d.outcome === 'paid';
      ms.supply = {
        n: seq, round: ms.round, hop: 'supply', who: 'merchant', name: m.shop, agent: agentKey(m.shop), what: `${need} ${m.inputUnit} of ${m.input} from the ${m.supplier.toLowerCase()}`,
        qty: need, unitCents: ms.inputCents, totalCents: total, outcome: paid ? 'paid' : 'stopped', rule: d.rule, ruleName: d.ruleName, reason: d.reason,
        token: paid ? issueToken(m.supplier, total, `${seq}:supply`) : null,
      };
      record(ms, ms.supply);
      if (!paid) return next;
      ms.merchant.spentCents += total;
      ms.offer = offer;
      for (const p of ms.people) evaluate(seq, ms, m, p);
      return next;
    }
    case 'merchantRules':
      ms.merchant.mandate.limitCents = num(a.limitCents, m.inputStep, m.inputCents * 4, ms.merchant.mandate.limitCents);
      return next;
    case 'inputPrice':
      ms.inputCents = num(a.cents, m.inputStep, m.inputCents * 4, ms.inputCents);
      return next;
    case 'close': {
      if (!ms.offer) return world;
      for (const e of Object.values(ms.attempts)) {
        if (e.outcome === 'ask') record(ms, { ...e, n: seq, outcome: 'declined', ruleName: 'No answer', reason: 'The offer ended before you answered.' });
      }
      ms.history.push({ ...ms.offer, peopleUnits: paidUnits(ms) });
      ms.offer = null;
      ms.supply = null;
      ms.attempts = {};
      ms.round += 1;
      return next;
    }
    case 'test': {
      const test = TESTS[a.kind];
      if (!person || !test) return world;
      const cents = ms.offer?.priceCents ?? m.baseCents;
      const d = decide(person.mandate, test.change({ shop: m.shop, cents, qty: person.qty, ...NOON }), person.spentCents);
      record(ms, {
        n: seq, round: ms.round, hop: 'test', who: person.id, name: person.name, agent: a.kind === 'fake' ? 'XX-0000' : person.agent, what: test.what,
        qty: person.qty, unitCents: cents, totalCents: 0, outcome: d.outcome, rule: d.rule, ruleName: d.ruleName,
        reason: d.outcome === 'stopped' ? d.reason : 'This test passed the rules of this mandate. It is a test, so no money moved.', token: null,
      });
      return next;
    }
    default:
      return world;
  }
}

// What each side can see.

export const RULE_LABEL: Record<Rule | 'declined', string> = {
  revoked: 'Mandate revoked', unknown: 'Unknown agent', shop: 'Shop not allowed', hours: 'Outside hours', limit: 'Price above their limit',
  weekly: 'Weekly budget reached', ask: 'Waiting for the owner', soldout: 'Sold out', declined: 'Owner said no', ok: 'Paid',
};

type CrowdDay = { customers: number; units: number; cents: number; stopped: Partial<Record<Rule, number>>; spent: number[] };

function crowdDay(m: Market, offer: Offer, capacityLeft: number, spentBefore: number[]): CrowdDay {
  const day: CrowdDay = { customers: 0, units: 0, cents: 0, stopped: {}, spent: [...spentBefore] };
  let left = capacityLeft;
  crowd(m).forEach((s, i) => {
    const units = Math.min(s.qty, left);
    const d = decide(seedMandate(s, m), { shop: m.shop, cents: offer.priceCents, qty: Math.max(units, 1), ...NOON }, spentBefore[i]);
    const rule: Rule | null = d.outcome !== 'paid' ? d.rule : units <= 0 ? 'soldout' : null;
    if (rule) {
      day.stopped[rule] = (day.stopped[rule] ?? 0) + 1;
      return;
    }
    left -= units;
    day.customers += 1;
    day.units += units;
    day.cents += units * offer.priceCents;
    day.spent[i] += units * offer.priceCents;
  });
  return day;
}

export type Today = { live: boolean; customers: number; units: number; cents: number; capacity: number; waiting: number; stopped: { rule: string; label: string; count: number }[]; supplyCents: number };
const days = new WeakMap<MarketState, Today>();

/** The merchant's day: totals only. People with names count first, then the other customers. */
export function today(ms: MarketState, m: Market): Today {
  const cached = days.get(ms);
  if (cached) return cached;
  const day: Today = { live: !!ms.offer, customers: 0, units: 0, cents: 0, capacity: ms.offer?.capacity ?? 0, waiting: 0, stopped: [], supplyCents: ms.supply?.outcome === 'paid' ? ms.supply.totalCents : 0 };
  if (ms.offer) {
    const tally: Record<string, number> = {};
    for (const e of Object.values(ms.attempts)) {
      const key = e.outcome === 'declined' ? 'declined' : e.rule;
      if (e.outcome === 'paid') {
        day.customers += 1;
        day.units += e.qty;
        day.cents += e.totalCents;
      } else if (e.outcome === 'ask') day.waiting += 1;
      else tally[key] = (tally[key] ?? 0) + 1;
    }
    let spent = crowd(m).map(() => 0);
    for (const h of ms.history) spent = crowdDay(m, h, h.capacity - h.peopleUnits, spent).spent;
    const rest = crowdDay(m, ms.offer, ms.offer.capacity - day.units, spent);
    day.customers += rest.customers;
    day.units += rest.units;
    day.cents += rest.cents;
    for (const [rule, count] of Object.entries(rest.stopped)) tally[rule] = (tally[rule] ?? 0) + count;
    day.stopped = Object.entries(tally).map(([rule, count]) => ({ rule, label: RULE_LABEL[rule as Rule], count })).sort((x, y) => y.count - x.count);
  }
  days.set(ms, day);
  return day;
}

const buyers = (ms: MarketState, m: Market) => [
  ...ms.people.filter((p) => !p.mandate.revoked && p.mandate.shops.includes(m.shop)).map((p) => ({ qty: p.qty, maxCents: p.mandate.limitCents })),
  ...crowd(m).filter((s) => s.allowed),
];

export function wanted(ms: MarketState, m: Market) {
  const list = buyers(ms, m);
  return { customers: list.length, units: list.reduce((a, c) => a + c.qty, 0) };
}

export type Level = { priceCents: number; customers: number; units: number; hidden: boolean };

/** Demand at each price, from the spending limits. A group under 50 customers stays hidden. */
export function demand(ms: MarketState, m: Market): Level[] {
  const list = buyers(ms, m);
  return Array.from({ length: 13 }, (_, i) => {
    const priceCents = m.baseCents + (i - 6) * m.stepCents;
    const group = list.filter((c) => c.maxCents >= priceCents);
    const hidden = group.length < MIN_GROUP;
    return { priceCents, hidden, customers: hidden ? 0 : group.length, units: hidden ? 0 : group.reduce((a, c) => a + c.qty, 0) };
  });
}

/** The price with the highest revenue for this quantity. */
export function suggestPrice(ms: MarketState, m: Market, capacity: number) {
  const revenue = (l: Level) => l.priceCents * Math.min(l.units, capacity);
  return demand(ms, m).filter((l) => !l.hidden).reduce((best, l) => (revenue(l) >= revenue(best) ? l : best)).priceCents;
}

export type Question = 'count' | 'who' | 'budget' | 'small';
export const QUESTIONS: { id: Question; text: (m: Market) => string }[] = [
  { id: 'count', text: (m) => `How many ${m.unit} for ${m.day}?` },
  { id: 'who', text: () => 'Who are these customers?' },
  { id: 'budget', text: () => 'How much can they spend?' },
  { id: 'small', text: () => 'What do my top 20 customers want?' },
];

/** The only path from customer data to a merchant: rounded totals for large groups. */
export function askNexi(q: Question, ms: MarketState, m: Market): { allowed: boolean; text: string } {
  if (q === 'who') return { allowed: false, text: 'Nexi does not share names.' };
  if (q === 'budget') return { allowed: false, text: 'Nexi does not share budgets or limits.' };
  if (q === 'small') return { allowed: false, text: `A group of 20 is too small. Nexi answers only for ${MIN_GROUP} customers or more.` };
  const w = wanted(ms, m);
  return { allowed: true, text: `About ${Math.round(w.units / 5) * 5} ${m.unit}, from about ${Math.round(w.customers / 10) * 10} customers.` };
}

/** What the supplier sees: one total in its own units. Firm after the merchant's agent paid. */
export function supplyView(ms: MarketState, m: Market) {
  const firm = ms.supply?.outcome === 'paid';
  const best = suggestPrice(ms, m, m.capacity);
  const capacity = ms.offer?.capacity ?? Math.min(m.capacity, demand(ms, m).find((l) => l.priceCents === best)?.units ?? 0);
  return { firm, need: inputNeed(m, capacity), order: ms.supply };
}
