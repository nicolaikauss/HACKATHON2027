import { describe, expect, it } from 'vitest';
import { backtest, mulberry32, shopTomorrow } from '../src/lib/forecast';
import { check } from '../src/lib/guard';
import { PRIVACY_EXAMPLES } from '../src/data/examples';
import { MIN_GROUP, questionsFor, reply } from '../src/lib/wall';

const on = { on: true, limitCents: 600 };

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

  it('stops every payment when the assistant is off', () => {
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

describe('Numbers, not names', () => {
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
