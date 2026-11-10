import { describe, expect, it } from 'vitest';
import { decide, issueToken, trace, type Mandate, type Purchase } from '../src/lib/guard';
import { askNexi, demand, initialWorld, marketOf, MARKETS, MIN_GROUP, mulberry32, reduce, suggestPrice, supplyView, today, wanted, type Action, type World } from '../src/lib/world';

const mandate: Mandate = { revoked: false, limitCents: 1000, weeklyCents: 3000, shops: ['A'], askAboveCents: 800, hoursOnly: true };
const buy: Purchase = { shop: 'A', cents: 500, signed: true, hour: 12, weekday: true };
const run = (actions: Action[], from: World = initialWorld()) => actions.reduce<World>((w, a) => reduce(w, a), from);
const bread = (w: World) => w.markets.bread;
const BREAD = marketOf('bread');
const attempt = (w: World, who: string) => bread(w).attempts[who];
const offer: Action = { type: 'offer', priceCents: 240, capacity: 350 };

describe('Mandate rules', () => {
  it('pays a purchase inside every rule', () => {
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

  it('checks the price of one item against the limit, and the total against the budget', () => {
    expect(decide({ ...mandate, askAboveCents: null }, { ...buy, qty: 6 }, 0).outcome).toBe('paid');
    expect(decide({ ...mandate, askAboveCents: null }, { ...buy, qty: 7 }, 0).rule).toBe('weekly');
    expect(decide(mandate, { ...buy, qty: 2 }, 0).rule).toBe('ask');
  });

  it('lets an approval answer only the ask rule', () => {
    expect(decide(mandate, { ...buy, cents: 900 }, 0, true).outcome).toBe('paid');
    expect(decide(mandate, { ...buy, cents: 1500 }, 0, true).rule).toBe('limit');
    expect(decide({ ...mandate, revoked: true }, buy, 0, true).rule).toBe('revoked');
  });

  it('never exceeds the weekly budget across 2,000 random weeks', () => {
    const rand = mulberry32(7);
    for (let w = 0; w < 2000; w += 1) {
      const m = { ...mandate, askAboveCents: null, weeklyCents: 500 + Math.floor(rand() * 5000) };
      let spent = 0;
      for (let d = 0; d < 12; d += 1) {
        const p = { ...buy, cents: Math.floor(rand() * 1000), qty: 1 + Math.floor(rand() * 3) };
        if (decide(m, p, spent).outcome === 'paid') spent += p.cents * p.qty;
        expect(spent).toBeLessThanOrEqual(m.weeklyCents);
      }
    }
  });

  it('shows which checks passed, which failed and which were not reached', () => {
    expect(trace('limit', 'stopped')).toEqual(['pass', 'pass', 'pass', 'pass', 'fail', 'skip', 'skip']);
    expect(trace('ask', 'ask').at(-1)).toBe('wait');
    expect(trace('ok', 'paid').every((s) => s === 'pass')).toBe(true);
  });

  it('issues a different token for a different shop', () => {
    expect(issueToken('A', 500, 1)).toMatch(/^TK-[0-9A-F]{8}$/);
    expect(issueToken('B', 500, 1)).not.toBe(issueToken('A', 500, 1));
  });
});

describe('Customers and the merchant', () => {
  it('starts with 446 loaves wanted, as in the video', () => {
    expect(wanted(bread(initialWorld()), BREAD)).toEqual({ customers: 220, units: 446 });
    expect(suggestPrice(bread(initialWorld()), BREAD, 350)).toBe(240);
  });

  it('matches 175 customers and 350 loaves for €840 once Giulia approves', () => {
    const live = run([offer]);
    expect(attempt(live, 'p1')).toMatchObject({ outcome: 'ask', rule: 'ask' });
    expect(today(bread(live), BREAD).waiting).toBe(1);
    const done = run([{ type: 'answer', who: 'p1', approve: true }], live);
    expect(attempt(done, 'p1')).toMatchObject({ outcome: 'paid', qty: 2, totalCents: 480 });
    expect(today(bread(done), BREAD)).toMatchObject({ customers: 175, units: 350, cents: 84000, waiting: 0 });
  });

  it('stops Luca at €2.40, and pays at once when he raises his limit', () => {
    const live = run([offer]);
    expect(attempt(live, 'p0')).toMatchObject({ outcome: 'stopped', rule: 'limit', token: null });
    expect(bread(live).people[0].spentCents).toBe(0);
    const raised = run([{ type: 'rules', who: 'p0', patch: { limitCents: 240 } }], live);
    expect(attempt(raised, 'p0')).toMatchObject({ outcome: 'paid', qty: 3, totalCents: 720 });
    expect(attempt(raised, 'p0').token).toMatch(/^TK-/);
    expect(bread(raised).people[0].spentCents).toBe(720);
  });

  it('gives every payment its own token', () => {
    const w = run([offer, { type: 'answer', who: 'p1', approve: true }]);
    const tokens = Object.values(bread(w).attempts).flatMap((e) => (e.token ? [e.token] : []));
    expect(tokens.length).toBeGreaterThan(3);
    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it('stops a revoked mandate, and a declined payment stays declined', () => {
    const w = run([{ type: 'rules', who: 'p5', patch: { revoked: true } }, offer, { type: 'answer', who: 'p1', approve: false }, { type: 'rules', who: 'p1', patch: { askAboveCents: null } }]);
    expect(attempt(w, 'p5').rule).toBe('revoked');
    expect(attempt(w, 'p1').outcome).toBe('declined');
    expect(bread(w).people[1].spentCents).toBe(0);
  });

  it('never sells above the quantity, a limit, a budget or to a blocked shop, for random rules and offers', () => {
    const rand = mulberry32(11);
    let published = 0;
    for (let i = 0; i < 150; i += 1) {
      const m = MARKETS[i % MARKETS.length];
      const edits: Action[] = Array.from({ length: 12 }, () => ({
        type: 'rules', who: `p${Math.floor(rand() * 10)}`,
        patch: { qty: 1 + Math.floor(rand() * 4), limitCents: Math.floor(m.baseCents * (0.5 + rand())), weeklyCents: Math.floor(m.baseCents * rand() * 8), allowShop: rand() < 0.8, revoked: rand() < 0.1 },
      }));
      const w = run([{ type: 'market', id: m.id }, ...edits, { type: 'offer', priceCents: Math.floor(m.baseCents * (0.6 + rand() * 0.8)), capacity: 5 + Math.floor(rand() * 400) }]);
      const ms = w.markets[m.id];
      if (!ms.offer) continue;
      published += 1;
      expect(today(ms, m).units).toBeLessThanOrEqual(ms.offer.capacity);
      for (const p of ms.people) {
        const e = ms.attempts[p.id];
        if (e.outcome !== 'paid') {
          expect(p.spentCents).toBe(0);
          continue;
        }
        expect(e.unitCents).toBeLessThanOrEqual(p.mandate.limitCents);
        expect(p.spentCents).toBeLessThanOrEqual(p.mandate.weeklyCents);
        expect(p.mandate.shops).toContain(m.shop);
        expect(p.mandate.revoked).toBe(false);
      }
    }
    expect(published).toBeGreaterThan(100);
  });

  it('keeps every weekly budget when the same offer repeats', () => {
    let w = initialWorld();
    for (let day = 0; day < 4; day += 1) w = run([{ type: 'offer', priceCents: 200, capacity: 400 }, { type: 'answer', who: 'p1', approve: true }, { type: 'close' }], w);
    expect(bread(w).round).toBe(5);
    for (const p of bread(w).people) expect(p.spentCents).toBeLessThanOrEqual(p.mandate.weeklyCents);
    expect(bread(w).log.some((e) => e.hop === 'shop' && e.rule === 'weekly')).toBe(true);
  });

  it('stops the merchant agent when the merchant weekly budget is used', () => {
    let w = initialWorld();
    for (let day = 0; day < 4; day += 1) w = run([{ type: 'offer', priceCents: 200, capacity: 400 }, { type: 'close' }], w);
    const fifth = run([{ type: 'offer', priceCents: 200, capacity: 400 }], w);
    expect(bread(fifth).offer).toBeNull();
    expect(bread(fifth).supply).toMatchObject({ outcome: 'stopped', rule: 'weekly' });
  });

  it('lets a new person join and buy from a live offer', () => {
    const w = run([offer, { type: 'join', id: 'guest-1', name: '  Nonna  ' }]);
    expect(bread(w).people.at(-1)).toMatchObject({ name: 'Nonna', live: true });
    expect(attempt(w, 'guest-1')).toMatchObject({ outcome: 'paid', qty: 1, totalCents: 240 });
    expect(reduce(w, { type: 'join', id: 'guest-1', name: 'Twice' })).toBe(w);
  });
});

describe('Guardrail tests and privacy', () => {
  it.each([['fake', 'unknown'], ['shop', 'shop'], ['price', 'limit'], ['night', 'hours']] as const)('blocks the %s test with the %s rule, and no money moves', (kind, rule) => {
    const w = run([{ type: 'test', who: 'p5', kind }]);
    expect(bread(w).log.at(-1)).toMatchObject({ hop: 'test', outcome: 'stopped', rule, totalCents: 0 });
    expect(bread(w).people[5].spentCents).toBe(0);
  });

  it('hides demand from groups under the minimum, and less is wanted as the price rises', () => {
    const levels = demand(bread(initialWorld()), BREAD);
    expect(levels.some((l) => l.hidden)).toBe(true);
    levels.forEach((l, i) => {
      if (!l.hidden) expect(l.customers).toBeGreaterThanOrEqual(MIN_GROUP);
      if (i && !l.hidden) expect(l.units).toBeLessThanOrEqual(levels[i - 1].units);
      if (l.hidden) expect(l).toMatchObject({ customers: 0, units: 0 });
    });
  });

  it('answers the merchant with rounded totals only', () => {
    const ms = bread(initialWorld());
    expect(askNexi('count', ms, BREAD)).toEqual({ allowed: true, text: 'About 445 loaves, from about 220 customers.' });
    for (const q of ['who', 'budget', 'small'] as const) expect(askNexi(q, ms, BREAD).allowed).toBe(false);
    expect(JSON.stringify(today(bread(run([offer])), BREAD))).not.toMatch(/Luca|Giulia|LU-|GI-/);
  });
});

describe('Merchant and supplier', () => {
  it('buys flour with a token before the offer goes live', () => {
    const w = run([offer]);
    expect(bread(w).supply).toMatchObject({ hop: 'supply', outcome: 'paid', qty: 175, totalCents: 15750 });
    expect(bread(w).merchant.spentCents).toBe(15750);
    expect(supplyView(bread(w), BREAD)).toMatchObject({ firm: true, need: 175 });
  });

  it('does not publish the offer when the supplier price is above the merchant limit', () => {
    const w = run([{ type: 'inputPrice', cents: 130 }, offer]);
    expect(bread(w).offer).toBeNull();
    expect(bread(w).supply).toMatchObject({ outcome: 'stopped', rule: 'limit', token: null });
    expect(bread(w).merchant.spentCents).toBe(0);
    expect(bread(run([{ type: 'merchantRules', limitCents: 130 }, offer], w)).offer).toEqual({ priceCents: 240, capacity: 350 });
  });

  it('keeps one offer for the day', () => {
    const w = run([offer]);
    expect(reduce(w, { type: 'offer', priceCents: 200, capacity: 10 })).toBe(w);
  });
});

describe('Actions from the network', () => {
  it('ignores broken actions and clamps wild numbers', () => {
    const w = initialWorld();
    for (const bad of [null, 7, 'x', {}, { type: 'nope' }, { type: 'rules', who: 'nobody', patch: {} }, { type: 'rules', who: 'p0' }, { type: 'answer', who: 'p0', approve: true }, { type: 'test', who: 'p0', kind: 'x' }, { type: 'join', id: 5, name: 5 }]) {
      expect(reduce(w, bad)).toBe(w);
    }
    const wild = run([{ type: 'rules', who: 'p0', patch: { qty: 1e9, limitCents: -5, weeklyCents: Number.NaN } }, { type: 'offer', priceCents: 1e12, capacity: -3 }]);
    expect(bread(wild).people[0]).toMatchObject({ qty: 3, mandate: { limitCents: 10, weeklyCents: 1960 } });
    expect(bread(wild).offer).toEqual({ priceCents: 1120, capacity: 1 });
  });
});
