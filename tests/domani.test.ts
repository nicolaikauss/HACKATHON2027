import { describe, expect, it } from 'vitest';
import { LIMIT_EXAMPLES, PRIVACY_EXAMPLES, purchaseOf, SHOP_EXAMPLES, startingMandate } from '../src/data/examples';
import { incoming, negotiate, settle } from '../src/lib/agents';
import { backtest, mulberry32, shopTomorrow } from '../src/lib/forecast';
import { check, decide, issueToken, priceCheck, type Mandate, type Purchase } from '../src/lib/guard';
import { demandCurve, makePool, match, NAMED, POOL, PRODUCTS, suggestPrice, summary } from '../src/lib/market';
import { bundles, categories, MIN_GROUP, questionsFor, reply, wantedNow } from '../src/lib/wall';

const on = { on: true, limitCents: 600 };
const mandate: Mandate = { revoked: false, limitCents: 1000, weeklyCents: 3000, shops: ['A'], askAboveCents: 800, hoursOnly: true };
const buy: Purchase = { shop: 'A', cents: 500, signed: true, hour: 12, weekday: true };

describe('Spending limit', () => {
  it('stops the €31.43 eggs', () => {
    expect(check(on, 3143).allowed).toBe(false);
  });

  it('pays €4.38 and states the reason', () => {
    const result = check(on, 438);
    expect(result.allowed).toBe(true);
    expect(result.reason).toContain('€4.38');
    expect(result.reason).toContain('€6.00');
  });

  it('stops every payment when the AI agent is off', () => {
    expect(check({ ...on, on: false }, 1).allowed).toBe(false);
  });

  it('never pays over the limit across 20,000 random prices', () => {
    const rand = mulberry32(99);
    for (let i = 0; i < 20000; i += 1) {
      const rules = { on: rand() < 0.8, limitCents: Math.floor(rand() * 4000) };
      const price = Math.floor(rand() * 5000);
      if (check(rules, price).allowed) {
        expect(rules.on).toBe(true);
        expect(price).toBeLessThanOrEqual(rules.limitCents);
      }
    }
  });
});

describe('Mandate', () => {
  it('passes a purchase inside every rule', () => {
    expect(decide(mandate, buy, 0).outcome).toBe('paid');
  });

  it.each([
    ['revoked', { ...mandate, revoked: true }, buy, 0],
    ['unknown', mandate, { ...buy, signed: false }, 0],
    ['shop', mandate, { ...buy, shop: 'B' }, 0],
    ['hours', mandate, { ...buy, hour: 23 }, 0],
    ['limit', mandate, { ...buy, cents: 1500 }, 0],
    ['weekly', mandate, buy, 2800],
    ['ask', mandate, { ...buy, cents: 900 }, 0],
  ] as const)('stops on the %s rule alone', (rule, m, p, spent) => {
    expect(decide(m, p, spent).rule).toBe(rule);
  });

  it('never exceeds the weekly budget across 2,000 random weeks', () => {
    const rand = mulberry32(7);
    for (let w = 0; w < 2000; w += 1) {
      const m = { ...mandate, askAboveCents: null, weeklyCents: 500 + Math.floor(rand() * 5000) };
      let spent = 0;
      for (let d = 0; d < 12; d += 1) {
        const cents = Math.floor(rand() * 1000);
        if (decide(m, { ...buy, cents }, spent).outcome === 'paid') spent += cents;
        expect(spent).toBeLessThanOrEqual(m.weeklyCents);
      }
    }
  });

  it('lets an approval answer only the ask rule', () => {
    expect(decide(mandate, { ...buy, cents: 900 }, 0, true).outcome).toBe('paid');
    expect(decide(mandate, { ...buy, cents: 1500 }, 0, true).rule).toBe('limit');
    expect(decide({ ...mandate, revoked: true }, buy, 0, true).rule).toBe('revoked');
  });

  it('issues a token for one shop and one amount', () => {
    const token = issueToken('A', 500, 1);
    expect(token).toMatchObject({ shop: 'A', cents: 500, validMinutes: 10 });
    expect(issueToken('B', 500, 1).id).not.toBe(token.id);
  });

  it('flags a price far above the usual range', () => {
    expect(priceCheck(3143, 320, 520, 14)).toMatchObject({ high: true });
    expect(priceCheck(3143, 320, 520, 14).text).toContain('× the usual price');
    expect(priceCheck(438, 320, 520, 14).high).toBe(false);
  });

  it.each(LIMIT_EXAMPLES.flatMap((e) => e.choices.map((c) => [e.label, c.label, e, c] as const)))('%s, %s gives its expected outcome', (_a, _b, e, c) => {
    expect(decide(startingMandate(e), purchaseOf(c), e.spent).rule).toBe(c.expect);
  });
});

describe('Live data, no names', () => {
  const byId = (id: string) => questionsFor(PRIVACY_EXAMPLES[0]).find((q) => q.id === id)!;

  it('gives the count, rounded', () => {
    const r = reply(byId('count'));
    expect(r.allowed).toBe(true);
    expect(r.text).toBe('About 25 loaves.');
  });

  it('refuses names and budgets', () => {
    expect(reply(byId('name')).allowed).toBe(false);
    expect(reply(byId('money')).allowed).toBe(false);
  });

  it('refuses a group under the minimum', () => {
    expect(reply({ id: 'x', text: 'x', kind: 'small', group: MIN_GROUP - 1 }).allowed).toBe(false);
  });

  it('never puts a name or budget in a bundle', () => {
    for (const e of PRIVACY_EXAMPLES) {
      const text = JSON.stringify([bundles(e, 3), categories(PRIVACY_EXAMPLES, 3)]);
      expect(text).not.toContain(e.person);
      expect(text).not.toContain(e.budget);
    }
  });

  it('counts only groups at or above the minimum', () => {
    expect(categories(PRIVACY_EXAMPLES, 0).every((c) => c.customers >= MIN_GROUP)).toBe(true);
  });

  it('shows the same number in bundles and the category table', () => {
    const e = PRIVACY_EXAMPLES[1];
    const wanted = `${wantedNow(e, 5)} ${e.unit}`;
    expect(bundles(e, 5).every((b) => b.fields[0].value === wanted)).toBe(true);
    expect(categories(PRIVACY_EXAMPLES, 5).find((c) => c.id === e.id)!.wanted).toBe(wanted);
  });
});

describe('Agents', () => {
  it('settles only signed and bank-authorised orders', () => {
    expect(settle({ agent: 'A', qty: 1, signed: true, bankAuthorised: true }).accepted).toBe(true);
    expect(settle({ agent: 'A', qty: 1, signed: false, bankAuthorised: true }).accepted).toBe(false);
    expect(settle({ agent: 'A', qty: 1, signed: true, bankAuthorised: false }).accepted).toBe(false);
    expect(incoming(5).some((o) => !settle(o).accepted)).toBe(true);
  });

  it('never goes above the buyer maximum or past 10% off', () => {
    const rand = mulberry32(5);
    for (let i = 0; i < 5000; i += 1) {
      const { deal, unit } = SHOP_EXAMPLES[Math.floor(rand() * SHOP_EXAMPLES.length)];
      const ask = { qty: 1 + Math.floor(rand() * 60), maxCents: Math.floor(deal.priceCents * (0.5 + rand())) };
      const r = negotiate(deal, ask, unit);
      if (r.kind === 'decline') continue;
      expect(r.priceCents).toBeLessThanOrEqual(ask.maxCents);
      expect(r.priceCents).toBeGreaterThanOrEqual(Math.ceil(deal.priceCents * 0.9));
      expect(r.qty).toBeLessThanOrEqual(deal.available);
    }
  });
});

describe('Market', () => {
  const product = PRODUCTS[0];
  const pool = makePool(product);

  it('makes a repeatable pool with ten named customers', () => {
    expect(pool).toEqual(makePool(product));
    expect(pool).toHaveLength(POOL);
    expect(pool.filter((c) => c.name).length).toBe(NAMED.length);
  });

  it('shows less demand as the price rises, and hides small groups', () => {
    const curve = demandCurve(pool, product);
    expect(curve.length).toBeGreaterThan(2);
    curve.forEach((l, i) => {
      expect(l.customers).toBeGreaterThanOrEqual(MIN_GROUP);
      if (i) expect(l.units).toBeLessThanOrEqual(curve[i - 1].units);
    });
  });

  it.each(PRODUCTS)('matches nobody outside a mandate or above capacity: $id', (p) => {
    const list = makePool(p);
    const offer = { priceCents: p.baseCents, capacity: Math.floor(summary(list).units / 3) };
    const result = match(list, p, offer);
    expect(result.units).toBeLessThanOrEqual(offer.capacity);
    for (const r of result.rows.filter((x) => x.units)) {
      expect(r.customer.allowed).toBe(true);
      expect(offer.priceCents).toBeLessThanOrEqual(r.customer.maxCents);
      expect(r.amountCents).toBeLessThanOrEqual(r.customer.weeklyCents);
    }
  });

  it.each(PRODUCTS)('suggests a price that earns at least the list price: $id', (p) => {
    const list = makePool(p);
    const suggested = suggestPrice(list, p, p.capacity);
    const earn = (cents: number) => cents * Math.min(demandCurve(list, p).find((l) => l.priceCents === cents)!.units, p.capacity);
    expect(earn(suggested)).toBeGreaterThanOrEqual(earn(p.baseCents));
  });
});

describe('Bread count', () => {
  it('is repeatable', () => {
    expect(shopTomorrow('bread', 0.4, 3, 0.6)).toEqual(shopTomorrow('bread', 0.4, 3, 0.6));
  });

  it('splits the total into lists and other customers', () => {
    const day = shopTomorrow('bread', 0.4, 3, 0.6);
    expect(day.lists + day.walkIn).toBe(day.total);
  });

  it('gives no gain with no lists, and a gain at 40%', () => {
    const none = backtest(0, undefined, 4);
    expect(Math.abs(none.wapeBefore - none.wapeAfter)).toBeLessThan(0.002);
    const some = backtest(0.4, undefined, 4);
    expect(some.wapeAfter).toBeLessThan(some.wapeBefore);
    expect(some.fillAfter).toBeGreaterThanOrEqual(some.fillBefore - 0.002);
  });
});
