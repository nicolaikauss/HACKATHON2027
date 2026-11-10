import { describe, expect, it } from 'vitest';
import { nameIn, pendingOf, respond, setup, understand, type Call } from '../src/lib/agent';
import { initialWorld, reduce, type Action, type World } from '../src/lib/world';

const ME = 'guest';
const joined = () => reduce(initialWorld(), { type: 'join', id: ME, name: 'Dea' });
const run = (actions: Action[], from: World) => actions.reduce<World>((w, a) => reduce(w, a), from);
const say = (text: string, world = joined(), focus = 'bread') => respond(world, ME, text, focus);
const calls = (text: string, pending = false) => understand(text, { focus: 'bread', pending });
const mine = (w: World, market = 'bread') => w.markets[market].people.find((p) => p.id === ME)!;

describe('Direct orders', () => {
  it('pays an order inside the rules, with a one-time token', () => {
    const w = reduce(joined(), { type: 'buy', who: ME, market: 'bread', qty: 2 });
    const entry = w.markets.bread.log.at(-1)!;
    expect(entry).toMatchObject({ outcome: 'paid', qty: 2, totalCents: 560, hop: 'shop' });
    expect(entry.token).toMatch(/^TK-/);
    expect(mine(w).spentCents).toBe(560);
  });

  it('acts in the named shop, and leaves the shop on screen alone', () => {
    const w = reduce(joined(), { type: 'buy', who: ME, market: 'flowers' });
    expect(w.market).toBe('bread');
    expect(w.markets.flowers.log).toHaveLength(1);
    expect(w.markets.bread.log).toHaveLength(0);
    expect(reduce(w, { type: 'buy', who: ME, market: 'nowhere' })).toBe(w);
  });

  it('holds an order for the owner, then pays or drops it', () => {
    const asked = run([{ type: 'rules', who: ME, market: 'bread', patch: { askAboveCents: 300 } }, { type: 'buy', who: ME, market: 'bread', qty: 2 }], joined());
    expect(asked.markets.bread.asks[ME].outcome).toBe('ask');
    expect(mine(asked).spentCents).toBe(0);

    const paid = reduce(asked, { type: 'answer', who: ME, market: 'bread', approve: true });
    expect(paid.markets.bread.log.at(-1)).toMatchObject({ outcome: 'paid', ruleName: 'Approved by you' });
    expect(paid.markets.bread.asks[ME]).toBeUndefined();
    expect(mine(paid).spentCents).toBe(560);

    const dropped = reduce(asked, { type: 'answer', who: ME, market: 'bread', approve: false });
    expect(dropped.markets.bread.log.at(-1)!.outcome).toBe('declined');
    expect(mine(dropped).spentCents).toBe(0);
  });

  it('checks the hard rules again when the owner approves', () => {
    const asked = run([{ type: 'rules', who: ME, market: 'bread', patch: { askAboveCents: 300 } }, { type: 'buy', who: ME, market: 'bread', qty: 2 }], joined());
    const revoked = run([{ type: 'rules', who: ME, market: 'bread', patch: { revoked: true } }, { type: 'answer', who: ME, market: 'bread', approve: true }], asked);
    expect(revoked.markets.bread.log.at(-1)).toMatchObject({ outcome: 'stopped', rule: 'revoked' });
    expect(mine(revoked).spentCents).toBe(0);
  });
});

describe('Understanding a sentence', () => {
  it.each<[string, Call[]]>([
    ['Buy two loaves', [{ tool: 'buy', market: 'bread', qty: 2 }]],
    ['I want flowers for Saturday', [{ tool: 'buy', market: 'flowers' }]],
    ['a sandwich, please', [{ tool: 'buy', market: 'sandwiches', qty: 1 }]],
    ['buy 2', [{ tool: 'buy', market: 'bread', qty: 2 }]],
    ['Buy bread and flowers', [{ tool: 'buy', market: 'bread' }, { tool: 'buy', market: 'flowers' }]],
    ['Never pay more than 3 euros for a loaf', [{ tool: 'rule', patch: { limitCents: 300 }, markets: ['bread'] }]],
    ['Raise the limit for fish to €15', [{ tool: 'rule', patch: { limitCents: 1500 }, markets: ['fish'] }]],
    ['Spend at most 30 euros a week', [{ tool: 'rule', patch: { weeklyCents: 3000 } }]],
    ['Ask me first above 5 euros', [{ tool: 'rule', patch: { askAboveCents: 500 } }]],
    ['Always ask me', [{ tool: 'rule', patch: { askAboveCents: 0 } }]],
    ['Stop asking me', [{ tool: 'rule', patch: { askAboveCents: null } }]],
    ['Stop everything!', [{ tool: 'rule', patch: { revoked: true } }]],
    ['stop', [{ tool: 'rule', patch: { revoked: true } }]],
    ['Resume', [{ tool: 'rule', patch: { revoked: false } }]],
    ["Don't buy from the fish stall", [{ tool: 'rule', patch: { allowShop: false }, markets: ['fish'] }]],
    ['Block the bakery and the florist', [{ tool: 'rule', patch: { allowShop: false }, markets: ['bread', 'flowers'] }]],
    ['You can use the fish stall', [{ tool: 'rule', patch: { allowShop: true }, markets: ['fish'] }]],
    ['Daytime only', [{ tool: 'rule', patch: { hoursOnly: true } }]],
    ['You can pay at night', [{ tool: 'rule', patch: { hoursOnly: false } }]],
    ['Try to pay at 3 am on Sunday', [{ tool: 'test', kinds: ['night'] }]],
    ['Pretend to be a fake agent', [{ tool: 'test', kinds: ['fake'] }]],
    ['Test the guardrails', [{ tool: 'test', kinds: ['fake', 'shop', 'price', 'night'] }]],
    ['Why did you stop?', [{ tool: 'explain' }]],
    ['What are my rules?', [{ tool: 'status' }]],
    ['How much did I spend this week?', [{ tool: 'status' }]],
    ['What can you do?', [{ tool: 'help' }]],
    ['Show me the florist', [{ tool: 'show', level: 'turin', market: 'flowers' }]],
    ['Go back to Europe', [{ tool: 'show', level: 'europe' }]],
    ['Pay at most 3 euros for bread and buy 2 loaves', [{ tool: 'rule', patch: { limitCents: 300 }, markets: ['bread'] }, { tool: 'buy', market: 'bread', qty: 2 }]],
  ])('%s', (text, want) => {
    expect(calls(text)).toEqual(want);
  });

  it('reads yes and no as an answer only when a payment waits', () => {
    expect(calls('Yes, pay', true)).toEqual([{ tool: 'answer', approve: true }]);
    expect(calls('No', true)).toEqual([{ tool: 'answer', approve: false }]);
    expect(calls('yes')[0].tool).toBe('say');
    expect(calls('Pay at most 3 euros for bread', true)[0].tool).toBe('rule');
  });

  it('does not guess a shop for an unknown item', () => {
    expect(calls('Buy me a laptop')[0].tool).toBe('say');
    expect(calls('qwerty')).toEqual([]);
  });
});

describe('The agent acts through the rules', () => {
  it('pays, and reports what Nexi decided', () => {
    const turn = say('Buy two loaves');
    expect(turn.say).toBe('Paid. €5.60 for 2 loaves at the bakery. All 7 checks passed.');
    expect(turn.entries).toHaveLength(1);
    expect(run(turn.actions, joined())).toEqual(turn.world);
  });

  it('cannot pay above the limit, in a blocked shop, or after a revoke', () => {
    expect(say('Buy fish', run([{ type: 'rules', who: ME, market: 'fish', patch: { limitCents: 500 } }], joined())).say).toContain('Stopped. No money moved. The price is €12.00. Your limit is €5.00.');
    expect(say("Don't buy from the florist and buy flowers").entries.at(-1)).toMatchObject({ outcome: 'stopped', rule: 'shop' });
    const stopped = say('Stop everything');
    expect(say('Buy bread', stopped.world).entries[0]).toMatchObject({ outcome: 'stopped', rule: 'revoked' });
  });

  it('asks first, then follows the spoken answer', () => {
    const asked = say('Ask me first above 5 euros and buy 2 loaves');
    expect(asked.say).toContain('Do I pay?');
    expect(pendingOf(asked.world, ME)?.market).toBe('bread');
    expect(say('Yes', asked.world).say).toBe('Paid. €5.60 for 2 loaves at the bakery. You approved it.');
    expect(say('No', asked.world).say).toContain('I did not pay.');
  });

  it('never orders more than the shop sells to one customer', () => {
    const turn = say('Buy ten loaves');
    expect(turn.entries[0].qty).toBe(3);
    expect(turn.say).toContain('at most 3 loaves');
  });

  it('stops all four attacks under the first rules', () => {
    const turn = say('Test the guardrails');
    expect(turn.entries.map((e) => e.rule)).toEqual(['unknown', 'shop', 'limit', 'hours']);
    expect(turn.say).toBe('I ran 4 tests against your rules. Nexi stopped all 4. No money moved.');
    expect(mine(turn.world).spentCents).toBe(0);
  });

  it('names the gap when a test passes the rules', () => {
    expect(say('Try to pay at 3 am', say('You can pay at night').world).say).toContain('This test passed the rules');
    expect(say('Test the guardrails', say('You can pay at night').world).say).toContain('Your rules do not stop: sunday, 03:00.');
  });

  it('explains the last decision with the check that stopped it', () => {
    const stopped = say('Buy flowers', run([{ type: 'rules', who: ME, market: 'flowers', patch: { limitCents: 1000 } }], joined()));
    expect(say('Why?', stopped.world).say).toBe('The last payment stopped at check 5 of 7: price above the limit. The price is €15.00. Your limit is €10.00.');
  });

  it('moves the map and the focus', () => {
    const turn = say('Show me the florist');
    expect(turn.show).toEqual({ level: 'turin', market: 'flowers' });
    expect(turn.focus).toBe('flowers');
    expect(say('Buy 1', turn.world, turn.focus).entries[0].market).toBe('flowers');
  });
});

describe('Onboarding', () => {
  it('finds the first name', () => {
    expect(nameIn('My name is dea')).toBe('Dea');
    expect(nameIn("Hi, I'm Nicolaï Kauss")).toBe('Nicolaï');
    expect(nameIn('42')).toBe('');
  });

  it('turns each answer into rules for every shop', () => {
    let w = joined();
    const step = (id: Parameters<typeof setup>[0], text: string) => {
      const answer = setup(id, text, ME);
      expect(answer.ok).toBe(true);
      w = run(answer.actions, w);
    };
    step('shops', 'The bakery and the florist');
    step('price', 'Up to 10% more');
    step('budget', '20 euros');
    step('ask', 'Above €10');
    step('hours', 'Any time');
    expect(mine(w, 'fish').mandate.shops).toEqual([]);
    expect(mine(w, 'flowers').mandate).toEqual({ revoked: false, limitCents: 1650, weeklyCents: 2000, shops: ['Florist'], askAboveCents: 1000, hoursOnly: false });
    expect(mine(w).mandate.limitCents).toBe(310);
  });

  it('asks again when the answer is not clear', () => {
    expect(setup('shops', 'hmm', ME).ok).toBe(false);
    expect(setup('budget', 'a lot', ME).ok).toBe(false);
    expect(setup('ask', 'never ask', ME).actions[0]).toMatchObject({ patch: { askAboveCents: null } });
  });
});
