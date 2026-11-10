// The customer's agent. It turns one sentence into tool calls, runs them through the shared
// engine, and reports what Nexi decided. It never decides a payment: reduce() and guard.ts do.
import { CHECKS, eur } from './guard';
import { MARKETS, marketOf, plural, reduce, TESTS, type Action, type Entry, type RulesPatch, type TestKind, type World } from './world';

export type MapLevel = 'europe' | 'italy' | 'turin';
/** A decision, with the shop it belongs to. */
export type Seen = Entry & { market: string };
export type Call =
  | { tool: 'buy'; market: string; qty?: number }
  | { tool: 'answer'; approve: boolean }
  | { tool: 'rule'; patch: RulesPatch; markets?: string[] }
  | { tool: 'test'; kinds: TestKind[] }
  | { tool: 'show'; level: MapLevel; market?: string }
  | { tool: 'status' | 'explain' | 'help' | 'hello' | 'thanks' }
  | { tool: 'say'; text: string };

// Words

const NUMBERS: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100 };
const NUMBER_WORD = new RegExp(`\\b(${Object.keys(NUMBERS).join('|')})\\b`, 'g');

/** Lower case, digits for number words, and `;` between sentences. */
export function clean(text: string) {
  return text.toLowerCase().replace(/[’‘`]/g, "'").replace(/\ba couple(?: of)?\b/g, '2').replace(/\ba dozen\b/g, '12')
    .replace(NUMBER_WORD, (w) => String(NUMBERS[w])).replace(/\b([2-5]0)[ -]([1-9])\b/g, (_, a: string, b: string) => String(Number(a) + Number(b)))
    .replace(/(\d),(\d)/g, '$1.$2').replace(/[,!?]+/g, ' ').replace(/\.(?=\s|$)/g, ' ; ').replace(/\s+/g, ' ').replace(/^[; ]+|[; ]+$/g, '');
}

const CASH = [/(?:€|eur(?:os?)?\s)\s?(\d+(?:\.\d{1,2})?)/, /(\d+(?:\.\d{1,2})?)\s?(?:€|euros?\b|eur\b)/, /(\d+\.\d{1,2})/];
const cents = (found: RegExpMatchArray | null) => (found ? Math.round(parseFloat(found[1]) * 100) : null);
/** An amount with a currency sign, or with decimals. */
const money = (t: string) => CASH.reduce<number | null>((got, re) => got ?? cents(t.match(re)), null);
/** The first number, when the sentence can mean only an amount. */
const bare = (t: string) => cents(t.match(/(\d+(?:\.\d{1,2})?)/));

const SHOP_WORDS: [string, RegExp][] = [
  ['bread', /bread|loaf|loaves|baker/],
  ['pastries', /pastr|croissant|cake|brioche/],
  ['sandwiches', /sandwich|lunch|panin/],
  ['fish', /fish|seafood/],
  ['flowers', /flower|florist|bunch|bouquet|roses?\b/],
];
export const shopsIn = (t: string) => SHOP_WORDS.filter(([, re]) => re.test(t)).map(([id]) => id);

function quantity(t: string) {
  const count = t.replace(/(?:€|eur(?:os?)?\s)\s?\d+(?:\.\d+)?|\d+(?:\.\d+)?\s?(?:€|euros?\b|eur\b|%|percent)/g, ' ').match(/\b(\d+)\b/);
  if (count) return parseInt(count[1], 10);
  return /\b(a|an)\s+(?:fresh\s+)?(loaf|pastry|croissant|sandwich|portion|bunch|bouquet|fish)/.test(t) ? 1 : undefined;
}

const list = (items: string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);
const the = (id: string) => `the ${marketOf(id).shop.toLowerCase()}`;
const EVERY = MARKETS.map((m) => m.id);

// From a sentence to tool calls

const YES = /^(yes|yeah|yep|yup|ok|okay|sure|approve|approved|go ahead|do it|pay|pay it|confirm|please do)( (please|pay|pay it|it|do it|go ahead|approve|thanks))*$/;
const NO = /^(no|nope|nah|don't|do not|cancel|decline|say no|not now|don't pay|do not pay)( (thanks|thank you|please|pay|it))*$/;
const BUY = /\b(buy|get|order|purchase|grab|pick up|reserve|want|need|i'd like|would like|bring)\b/;
const FILLER = /\b(buy|get|order|purchase|grab|pick up|reserve|want|need|like|bring|i|i'd|would|me|us|some|more|please|a|an|the|it|that|this|again|same|another|now|today|tomorrow|for|on|friday|saturday|monday|my|usual|can|could|you|to|of|x|try|retry|\d+)\b/g;
const ALL_TESTS: TestKind[] = ['fake', 'shop', 'price', 'night'];
const rule = (patch: RulesPatch, markets?: string[]): Call => ({ tool: 'rule', patch, ...(markets?.length ? { markets } : {}) });

/** `part` marks one half of a longer sentence. A half must hold its own verb, or "block the bakery and the florist" buys flowers. */
type Context = { focus: string; pending: boolean; part?: boolean };

function one(t: string, ctx: Context): Call[] | null {
  if (!t) return null;
  const shops = shopsIn(t);
  const cash = money(t);
  const qty = quantity(t);

  if (YES.test(t)) return [ctx.pending ? { tool: 'answer', approve: true } : { tool: 'say', text: 'Nothing waits for your answer.' }];
  if (NO.test(t)) return [ctx.pending ? { tool: 'answer', approve: false } : { tool: 'say', text: 'Nothing waits for your answer.' }];
  if (/^(why|what happened|what went wrong|explain)\b|which (rule|check)/.test(t)) return [{ tool: 'explain' }];
  if (/\bhelp\b|what can (you|i) (do|say)|how does (this|it) work|(who|what) are you/.test(t)) return [{ tool: 'help' }];
  if (/^(try |do )?(it )?again$|^retry$|^same again$/.test(t)) return [{ tool: 'buy', market: ctx.focus }];

  const kinds: TestKind[] = [];
  if (/fake|unsigned|impost[oe]r|rogue|another agent|pretend/.test(t)) kinds.push('fake');
  if (/unknown|web ?shop|website|scam|strange/.test(t)) kinds.push('shop');
  if (/10 ?(x|×|times)|higher|overcharg|rip.?off/.test(t)) kinds.push('price');
  if (/\b0?3(:00)? ?(am|a\.m)|sunday|midnight|night/.test(t)) kinds.push('night');
  const probing = /\b(try|test|what if|what happens|pretend|simulate|attempt|attack|trick|break|hack|fool|cheat)\b/.test(t);
  if (probing && (kinds.length || !shops.length)) return [{ tool: 'test', kinds: kinds.length ? kinds : ALL_TESTS }];
  if (/fake agent|unsigned|scam/.test(t)) return [{ tool: 'test', kinds }];

  if (cash === null && /\b(what|how much|how many|show|tell me|list|which)\b.*\b(rules?|spen[dt]|bought|buy|budget|left|limits?|mandate|receipts?|paid|pay|guardrails?)\b/.test(t)) return [{ tool: 'status' }];

  if (/\b(ask|asking|approval|approve|permission|check with me|confirm with me)\b/.test(t)) {
    if (/(never|don't|do not|stop|no need to|without|no more) (ask|asking)|without (my )?(approval|permission)/.test(t)) return [rule({ askAboveCents: null })];
    return [rule({ askAboveCents: cash ?? bare(t) ?? 0 })];
  }
  if (/\b(week|weekly|budget)\b/.test(t)) {
    const amount = cash ?? bare(t);
    if (amount !== null) return [rule({ weeklyCents: amount }, shops.slice(0, 1))];
  }
  if (/\b(at most|max|maximum|no more than|not more than|more than|up to|limit|cap|price)\b/.test(t)) {
    const amount = cash ?? (/\b(limit|max|maximum|cap|price)\b/.test(t) ? bare(t) : null);
    if (amount !== null) return [rule({ limitCents: amount }, [shops[0] ?? ctx.focus])];
  }
  if (/daytime|day time|during the day|working hours|office hours|not at night|no nights?|only (on )?weekdays|weekdays only/.test(t)) return [rule({ hoursOnly: true })];
  if (/any ?time|at night|nights? too|weekends?|24.?7|around the clock/.test(t)) return [rule({ hoursOnly: false })];

  const blocks = /\b(block|ban|forbid|remove|disallow|exclude|avoid)\b|\bnever (buy|use|pay|shop|go)|(don't|do not|no longer|stop) (buy|use|pay|shop|go|buying|using|paying)|not allowed/.test(t);
  if (blocks && shops.length) return [rule({ allowShop: false }, shops)];
  if (/^stop$|\bstop (everything|all|the agent|paying|payments|buying|it all|now|it)\b|\b(pause|freeze|revoke|shut ?down|emergency|halt)\b|block (everything|all)/.test(t)) return [rule({ revoked: true })];
  if (/\b(resume|unpause|unfreeze|reactivate|restart|start again|activate|continue)\b|(turn|switch) (it |the agent )?(back )?on|pay again/.test(t)) return [rule({ revoked: false })];
  if (/\b(allow|unblock|add|permit|enable|trust)\b|you (can|may) (use|buy|pay|shop)|\b(is|are) (ok|okay|fine|allowed)\b/.test(t)) {
    const which = /\b(all|every|any)\b/.test(t) ? EVERY : shops;
    if (which.length) return [rule({ allowShop: true }, which)];
  }

  if (/\b(show|go to|zoom|fly|open|where|take me|see|map|back to|look at)\b/.test(t)) {
    if (/europe/.test(t)) return [{ tool: 'show', level: 'europe' }];
    if (/ital/.test(t)) return [{ tool: 'show', level: 'italy' }];
    if (shops.length) return [{ tool: 'show', level: 'turin', market: shops[0] }];
    if (/torino|turin|city|shops?|map|zoom in/.test(t)) return [{ tool: 'show', level: 'turin' }];
  }

  if (BUY.test(t) || (!ctx.part && shops.length > 0 && (qty !== undefined || t.split(' ').length <= 3))) {
    if (shops.length) return shops.map((market): Call => ({ tool: 'buy', market, ...(shops.length === 1 && qty !== undefined ? { qty } : {}) }));
    if (!t.replace(FILLER, '').trim()) return [{ tool: 'buy', market: ctx.focus, ...(qty !== undefined ? { qty } : {}) }];
    return [{ tool: 'say', text: `I do not know a shop for that. I can buy ${list(MARKETS.map((m) => m.label.toLowerCase()))}.` }];
  }

  if (/\b(rules?|mandate|guardrails?|settings|status|summary|history|receipts?|spen[dt]|budget|limits?)\b/.test(t)) return [{ tool: 'status' }];
  if (/^(hi|hello|hey|good (morning|afternoon|evening)|ciao|buongiorno)\b/.test(t)) return [{ tool: 'hello' }];
  if (/thank|grazie|great|perfect|nice|cool|awesome/.test(t)) return [{ tool: 'thanks' }];
  return null;
}

/** One sentence can hold more than one command: "pay at most 3 euros for bread and buy 2 loaves". */
export function understand(text: string, ctx: Context): Call[] {
  const t = clean(text);
  const parts = t.split(/\s*(?:\band then\b|\bthen\b|\band\b|;)\s*/).filter(Boolean);
  if (parts.length > 1) {
    const each = parts.map((part) => one(part, { ...ctx, part: true }));
    if (each.every((calls) => calls && calls[0].tool !== 'say')) return each.flatMap((calls) => calls ?? []);
  }
  return one(t.replace(/ ?; ?/g, ' '), ctx) ?? [];
}

// From tool calls to the engine, and to a spoken answer

const person = (w: World, market: string, who: string) => w.markets[market]?.people.find((p) => p.id === who);
const logOf = (w: World, who: string, after: number): Seen[] =>
  MARKETS.flatMap((m) => w.markets[m.id].log.filter((e) => e.who === who && e.n > after).map((e) => ({ ...e, market: m.id }))).sort((a, b) => a.n - b.n);
export const historyOf = (w: World, who: string) => logOf(w, who, -1);

/** The payment that waits for the owner, in any shop. */
export function pendingOf(w: World, who: string): Seen | null {
  for (const m of MARKETS) {
    const ms = w.markets[m.id];
    const open = ms.attempts[who]?.outcome === 'ask' ? ms.attempts[who] : ms.asks[who];
    if (open?.outcome === 'ask') return { ...open, market: m.id };
  }
  return null;
}

export function sentence(e: Seen) {
  const m = marketOf(e.market);
  if (e.hop === 'test') return `${e.what}. ${e.outcome === 'stopped' ? 'Stopped. ' : ''}${e.reason}`;
  if (e.outcome === 'paid') return `Paid. ${eur(e.totalCents)} for ${plural(e.qty, m)} at ${the(m.id)}. ${e.ruleName === 'Approved by you' ? 'You approved it.' : 'All 7 checks passed.'}`;
  if (e.outcome === 'ask') return `${e.reason} Do I pay?`;
  if (e.outcome === 'declined') return `I did not pay. ${e.reason}`;
  return `Stopped. No money moved. ${e.reason}`;
}

const askLine = (v: number | null) => (v === null ? 'I pay without asking you.' : v === 0 ? 'I ask you before every payment.' : `I ask you first when a payment is above ${eur(v)}.`);
const HOURS = { true: 'I pay only on weekdays, from 08:00 to 20:00.', false: 'I can pay at any time.' };
const HELP = `I am your payment agent. I can buy ${list(MARKETS.map((m) => m.label.toLowerCase()))} in Torino. You can change a rule, ask why a payment stopped, or say stop to block all payments. Nexi checks every payment against your rules.`;
export const UNKNOWN = 'I did not understand that. You can say: buy 2 loaves, pay at most 3 euros for bread, ask me first above 5 euros, or stop everything.';

type Step = { world: World; say: string; actions: Action[]; focus: string; show?: { level: MapLevel; market?: string }; rules?: boolean };

function run(world: World, who: string, call: Call, focus: string): Step {
  const done = (say: string, actions: Action[] = [], more: Partial<Step> = {}): Step => {
    const next = actions.reduce((w, a) => reduce(w, a), world);
    return { world: next, say: [say, ...(more.say === undefined ? logOf(next, who, world.seq).map(sentence) : [])].filter(Boolean).join(' '), actions, focus, ...more };
  };
  const me = person(world, focus, who);
  if (!me) return done('Set up your agent first.', [], { say: 'Set up your agent first.' });

  switch (call.tool) {
    case 'buy': {
      const m = marketOf(call.market);
      const ms = world.markets[m.id];
      const final = ms.offer ? ms.attempts[who] : undefined;
      if (final?.outcome === 'paid') return done('', [], { focus: m.id, say: `I already bought ${plural(final.qty, m)} at ${the(m.id)} today, for ${eur(final.totalCents)}.` });
      if (final?.outcome === 'declined') return done('', [], { focus: m.id, say: `You said no to today's offer at ${the(m.id)}. I do not ask again today.` });
      const action: Action = { type: 'buy', who, market: m.id, ...(call.qty ? { qty: Math.min(call.qty, m.maxQty) } : {}) };
      const next = reduce(world, action);
      const result = logOf(next, who, world.seq).at(-1) ?? (next.markets[m.id].attempts[who] ? { ...next.markets[m.id].attempts[who], market: m.id } : null);
      const note = call.qty && call.qty > m.maxQty ? `${m.shop} sells at most ${plural(m.maxQty, m)} to one customer. ` : '';
      return done('', [action], { focus: m.id, say: note + (result ? sentence(result) : 'I could not order that.') });
    }
    case 'answer': {
      const open = pendingOf(world, who);
      if (!open) return done('Nothing waits for your answer.');
      return done('', [{ type: 'answer', who, approve: call.approve, market: open.market }], { focus: open.market });
    }
    case 'rule': {
      const ids = call.markets?.length ? call.markets : EVERY;
      const actions = ids.map((market): Action => ({ type: 'rules', who, market, patch: call.patch }));
      const at = ids.includes(focus) ? focus : ids[0];
      const after = person(actions.reduce((w, a) => reduce(w, a), world), at, who)?.mandate ?? me.mandate;
      const m = marketOf(at);
      const k = call.patch;
      const where = list(ids.map(the));
      const say = k.revoked === true ? 'Stopped. Your mandate is revoked. I cannot pay until you say resume.'
        : k.revoked === false ? 'Your mandate is active again. I can pay inside your rules.'
        : 'limitCents' in k ? `Done. At ${the(at)}, I pay at most ${eur(after.limitCents)} for one ${m.noun}.`
        : 'weeklyCents' in k ? (call.markets?.length ? `Done. At ${where}, I spend at most ${eur(after.weeklyCents)} each week.` : `Done. I spend at most ${eur(after.weeklyCents)} each week in one shop.`)
        : 'askAboveCents' in k ? `Done. ${askLine(after.askAboveCents)}`
        : k.allowShop === true ? `Done. I can pay at ${where}.`
        : k.allowShop === false ? `Done. I do not pay at ${where}.`
        : `Done. ${HOURS[`${after.hoursOnly}`]}`;
      return done(say, actions, { focus: call.markets?.length === 1 ? at : focus });
    }
    case 'test': {
      const actions = call.kinds.map((kind): Action => ({ type: 'test', who, kind, market: focus }));
      const news = logOf(actions.reduce((w, a) => reduce(w, a), world), who, world.seq);
      if (news.length < 2) return done('', actions);
      const passed = call.kinds.filter((_, i) => news[i]?.outcome !== 'stopped').map((kind) => TESTS[kind].label.toLowerCase());
      const say = `I ran ${news.length} tests against your rules. Nexi stopped ${passed.length ? `${news.length - passed.length} of ${news.length}` : `all ${news.length}`}. No money moved.`;
      return done('', actions, { say: passed.length ? `${say} Your rules do not stop: ${list(passed)}.` : say });
    }
    case 'show': {
      const m = call.market ? marketOf(call.market) : null;
      const say = m ? `Here is ${the(m.id)}, in ${m.area}.` : call.level === 'turin' ? 'Here are the shops in Torino.' : call.level === 'italy' ? 'Here is Italy.' : 'Here is Europe.';
      return done(say, [], { show: { level: call.level, market: call.market }, focus: m?.id ?? focus });
    }
    case 'status': {
      const m = marketOf(focus);
      const r = me.mandate;
      const open = MARKETS.filter((x) => person(world, x.id, who)?.mandate.shops.length).map((x) => the(x.id));
      if (r.revoked) return done('Your mandate is revoked. I cannot pay. Say resume to turn it on again.', [], { rules: true });
      return done([
        'Your mandate is active.',
        `At ${the(m.id)}, I pay at most ${eur(r.limitCents)} for one ${m.noun}, and at most ${eur(r.weeklyCents)} each week.`,
        `You used ${eur(me.spentCents)} there this week.`,
        askLine(r.askAboveCents),
        HOURS[`${r.hoursOnly}`],
        open.length ? `I can pay at ${list(open)}.` : 'No shop is allowed.',
      ].join(' '), [], { rules: true });
    }
    case 'explain': {
      const last = historyOf(world, who).at(-1);
      if (!last) return done('I did not try a payment yet.');
      if (last.outcome === 'paid') return done(`The last payment passed all 7 checks: ${last.what}, for ${eur(last.totalCents)}.`);
      const i = CHECKS.findIndex((c) => c.id === last.rule);
      if (i < 0 || last.outcome === 'declined') return done(last.reason);
      return done(`The last payment ${last.outcome === 'ask' ? 'waits' : 'stopped'} at check ${i + 1} of 7: ${last.ruleName.toLowerCase()}. ${last.reason}`);
    }
    case 'help': return done(HELP);
    case 'hello': return done(`Hello, ${me.name}. What do I buy for you?`);
    case 'thanks': return done('You are welcome.');
    case 'say': return done(call.text);
    default: return done(UNKNOWN);
  }
}

export type Turn = { say: string; actions: Action[]; entries: Seen[]; world: World; focus: string; show?: Step['show']; rules: boolean; understood: boolean };

/** One sentence from the customer: what the agent does, and what it says. Commit `actions` with act(). */
export function respond(world: World, who: string, text: string, focus: string): Turn {
  const calls = understand(text, { focus, pending: !!pendingOf(world, who) });
  const turn: Turn = { say: UNKNOWN, actions: [], entries: [], world, focus, rules: false, understood: calls.length > 0 };
  if (!calls.length) return turn;
  const says: string[] = [];
  for (const call of calls) {
    const step = run(turn.world, who, call, turn.focus);
    says.push(step.say);
    turn.actions.push(...step.actions);
    turn.world = step.world;
    turn.focus = step.focus;
    turn.show = step.show ?? turn.show;
    turn.rules ||= !!step.rules;
  }
  return { ...turn, say: says.join(' '), entries: logOf(turn.world, who, world.seq) };
}

// Onboarding: six questions. Each answer becomes a rule in the mandate.

export type SetupStep = 'name' | 'shops' | 'price' | 'budget' | 'ask' | 'hours';
export const SETUP: { id: SetupStep; label: string; ask: string; chips: string[]; usual: string }[] = [
  { id: 'name', label: 'Your name', ask: 'Hello. I am your payment agent. Before I can pay, you set my rules. First: what is your first name?', chips: [], usual: '' },
  { id: 'shops', label: 'Shops', ask: 'Which shops can I pay? Choose them on the map, or say their names.', chips: ['All five shops'], usual: 'all five shops' },
  { id: 'price', label: 'Price limit', ask: 'How much can I pay for one item?', chips: ['The usual price', 'Up to 10% more', 'Up to 25% more'], usual: 'the usual price' },
  { id: 'budget', label: 'Weekly budget', ask: 'How much can I spend each week in one shop?', chips: ['€10', '€20', '€40'], usual: '€20' },
  { id: 'ask', label: 'Ask me first', ask: 'When do I ask you before I pay?', chips: ['Above €5', 'Above €10', 'Never ask'], usual: 'above €10' },
  { id: 'hours', label: 'Hours', ask: 'Last question. When can I pay?', chips: ['Daytime only', 'Any time'], usual: 'daytime only' },
];
export const RECOMMENDED = 'Use the recommended rules';
export const wantsRecommended = (text: string) => /recommend|default|skip|quick|you (choose|decide)/.test(clean(text));

/** The first name in "my name is Dea", "I'm Dea" or "Dea". */
export function nameIn(text: string) {
  const rest = text.trim().replace(/^(hi|hello|hey|ciao)[,.! ]+/i, '').replace(/^(my name is|my name's|i am|i'm|it is|it's|this is|call me|name is)\s+/i, '');
  const word = rest.match(/[\p{L}][\p{L}'-]*/u)?.[0] ?? '';
  return word ? (word[0].toUpperCase() + word.slice(1)).slice(0, 14) : '';
}

type SetupAnswer = { ok: boolean; say: string; actions: Action[] };

/** Reads the answer to one onboarding question. `ok: false` means: ask again. */
export function setup(step: SetupStep, text: string, who: string): SetupAnswer {
  const t = clean(text);
  const amount = money(t) ?? bare(t);
  const all = (patch: (id: string) => RulesPatch): Action[] => EVERY.map((market) => ({ type: 'rules', who, market, patch: patch(market) }));
  const no = (say: string): SetupAnswer => ({ ok: false, say, actions: [] });

  if (step === 'shops') {
    const chosen = /\b(all|every|any|5)\b/.test(t) ? EVERY : shopsIn(t);
    if (!chosen.length) return no('Choose one shop or more. For example: the bakery and the florist.');
    return { ok: true, say: `Good. I can pay at ${chosen.length === EVERY.length ? 'all five shops' : list(chosen.map(the))}.`, actions: all((id) => ({ allowShop: chosen.includes(id) })) };
  }
  if (step === 'price') {
    const percent = t.match(/(\d+) ?(%|percent)/);
    const factor = percent ? 1 + Math.min(100, Number(percent[1])) / 100 : /usual|normal|exact|same|list|no more/.test(t) ? 1 : null;
    if (factor === null) return no('Say: the usual price, or up to 10% more.');
    const limit = (id: string) => {
      const m = marketOf(id);
      return Math.round((m.baseCents * factor) / (m.stepCents / 2)) * (m.stepCents / 2);
    };
    const bread = MARKETS[0];
    return { ok: true, say: `Done. For example, I pay at most ${eur(limit(bread.id))} for one ${bread.noun}.`, actions: all((id) => ({ limitCents: limit(id) })) };
  }
  if (step === 'budget') {
    if (!amount) return no('Say an amount. For example: 20 euros.');
    return { ok: true, say: `Done. I spend at most ${eur(amount)} each week in one shop.`, actions: all(() => ({ weeklyCents: amount })) };
  }
  if (step === 'ask') {
    const never = /never|no need|don't|do not|without/.test(t);
    const above = never ? null : /always|every/.test(t) ? 0 : amount;
    if (above === null && !never) return no('Say an amount, or say: never ask.');
    return { ok: true, say: `Done. ${askLine(above)}`, actions: all(() => ({ askAboveCents: above })) };
  }
  if (step === 'hours') {
    const any = /any|night|always|24|weekend/.test(t);
    if (!any && !/day|only|work|office/.test(t)) return no('Say: daytime only, or any time.');
    return { ok: true, say: `Done. ${HOURS[`${!any}`]}`, actions: all(() => ({ hoursOnly: !any })) };
  }
  return no('');
}

export function signed(world: World, who: string) {
  const me = person(world, MARKETS[0].id, who);
  return `Your mandate is signed. Your agent key is ${me?.agent ?? 'ready'}. Nexi checks every payment against your rules. Now tell me what to buy. For example: buy 2 loaves.`;
}
