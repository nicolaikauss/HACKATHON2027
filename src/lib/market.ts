// The demo market: signed mandates at Nexi, demand by price, and matching a supplier's offer.
import { mulberry32 } from './forecast';
import { decide, eur, type Mandate } from './guard';
import { MIN_GROUP } from './wall';

export type Product = {
  id: string; label: string; supplier: string; noun: string; unit: string; when: string;
  baseCents: number; stepCents: number; capacity: number; maxQty: number;
};

export const PRODUCTS: Product[] = [
  { id: 'bread', label: 'Fresh bread', supplier: 'Bakery', noun: 'loaf', unit: 'loaves', when: 'Friday', baseCents: 280, stepCents: 20, capacity: 350, maxQty: 3 },
  { id: 'flight', label: 'Flight to Helsinki', supplier: 'Airline', noun: 'seat', unit: 'seats', when: '12 December', baseCents: 18000, stepCents: 1000, capacity: 180, maxQty: 2 },
  { id: 'flowers', label: 'Flowers', supplier: 'Florist', noun: 'bunch', unit: 'bunches', when: 'Saturday', baseCents: 1500, stepCents: 100, capacity: 180, maxQty: 2 },
];

export const POOL = 240;
export const NAMED = [
  { name: 'Luca', age: 24 }, { name: 'Giulia', age: 31 }, { name: 'Marco', age: 45 }, { name: 'Sara', age: 28 }, { name: 'Elena', age: 37 },
  { name: 'Paolo', age: 52 }, { name: 'Chiara', age: 22 }, { name: 'Davide', age: 41 }, { name: 'Anna', age: 66 }, { name: 'Matteo', age: 29 },
];

export type Customer = { id: number; name: string | null; age: number | null; qty: number; maxCents: number; weeklyCents: number; allowed: boolean };

/** The same product always gives the same 240 customers. */
export function makePool(product: Product): Customer[] {
  const seed = [...product.id].reduce((a, c) => a * 31 + c.charCodeAt(0), 2028);
  const rand = mulberry32(seed);
  const half = product.stepCents / 2;
  return Array.from({ length: POOL }, (_, id) => {
    const qty = 1 + Math.floor(rand() * product.maxQty);
    const maxCents = Math.round((product.baseCents * (0.7 + 0.65 * rand())) / half) * half;
    const weeklyCents = product.baseCents * (qty + 1 + Math.floor(rand() * 4));
    const allowed = rand() < 0.9;
    return { id, name: NAMED[id]?.name ?? null, age: NAMED[id]?.age ?? null, qty, maxCents, weeklyCents, allowed };
  });
}

export function mandateFor(customer: Customer, product: Product): Mandate {
  return { revoked: false, limitCents: customer.maxCents, weeklyCents: customer.weeklyCents, shops: customer.allowed ? [product.supplier] : [], askAboveCents: null, hoursOnly: false };
}

export function summary(pool: Customer[]) {
  const allowing = pool.filter((c) => c.allowed);
  return { customers: pool.length, allowing: allowing.length, units: allowing.reduce((a, c) => a + c.qty, 0) };
}

export type DemandLevel = { priceCents: number; customers: number; units: number };

/** At each price: who would buy, from the spending limits. Groups under the minimum stay hidden. */
export function demandCurve(pool: Customer[], product: Product): DemandLevel[] {
  const levels: DemandLevel[] = [];
  for (let k = -6; k <= 6; k += 1) {
    const priceCents = product.baseCents + k * product.stepCents;
    const buyers = pool.filter((c) => c.allowed && c.maxCents >= priceCents);
    if (buyers.length >= MIN_GROUP) levels.push({ priceCents, customers: buyers.length, units: buyers.reduce((a, c) => a + c.qty, 0) });
  }
  return levels;
}

export function suggestPrice(pool: Customer[], product: Product, capacity: number) {
  const revenue = (l: DemandLevel) => l.priceCents * Math.min(l.units, capacity);
  return demandCurve(pool, product).reduce((best, l) => (revenue(l) >= revenue(best) ? l : best)).priceCents;
}

export type Offer = { priceCents: number; capacity: number };
export type MatchRow = { customer: Customer; units: number; amountCents: number; reason: string | null };

/** Checks the offer against every mandate with the spending-limit rules, and fills capacity in order. */
export function match(pool: Customer[], product: Product, offer: Offer) {
  let left = offer.capacity;
  const rows: MatchRow[] = pool.map((customer) => {
    const who = customer.name ?? 'This customer';
    const units = Math.min(customer.qty, left);
    const decision = decide(mandateFor(customer, product), { shop: product.supplier, cents: offer.priceCents, signed: true, hour: 12, weekday: true }, offer.priceCents * (Math.max(units, 1) - 1));
    if (decision.outcome !== 'paid') {
      const reason = decision.rule === 'shop' ? `${who} does not allow this ${product.supplier.toLowerCase()}.`
        : decision.rule === 'limit' ? `${who} pays at most ${eur(customer.maxCents)} a ${product.noun}.`
        : `${who} has a weekly budget of ${eur(customer.weeklyCents)}.`;
      return { customer, units: 0, amountCents: 0, reason };
    }
    if (units <= 0) return { customer, units: 0, amountCents: 0, reason: `Sold out before ${who}.` };
    left -= units;
    return { customer, units, amountCents: units * offer.priceCents, reason: null };
  });
  const matched = rows.filter((r) => r.units > 0);
  return { rows, customers: matched.length, units: matched.reduce((a, r) => a + r.units, 0), amountCents: matched.reduce((a, r) => a + r.amountCents, 0) };
}
