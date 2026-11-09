// Spending limit and mandate rules: Nexi checks every AI agent payment before the money moves.

export type Rules = { on: boolean; limitCents: number };

export type Result = { allowed: boolean; title: string; reason: string };

export const eur = (cents: number) => `€${(cents / 100).toFixed(2)}`;

export function check(rules: Rules, priceCents: number): Result {
  if (!rules.on) {
    return { allowed: false, title: 'Stopped. No money moved.', reason: 'You turned off the AI agent.' };
  }
  const facts = `The price is ${eur(priceCents)}. Your limit is ${eur(rules.limitCents)}.`;
  if (priceCents > rules.limitCents) return { allowed: false, title: 'Stopped. No money moved.', reason: facts };
  return { allowed: true, title: 'Paid.', reason: facts };
}

export type Mandate = {
  revoked: boolean;
  limitCents: number;
  weeklyCents: number;
  shops: string[];
  askAboveCents: number | null;
  hoursOnly: boolean;
};

export type Purchase = { shop: string; cents: number; signed: boolean; hour: number; weekday: boolean };
export type RuleId = 'revoked' | 'unknown' | 'shop' | 'hours' | 'limit' | 'weekly' | 'ask' | 'ok';
export type Decision = { outcome: 'paid' | 'stopped' | 'ask'; rule: RuleId; ruleName: string; title: string; reason: string };

const STOPPED = 'Stopped. No money moved.';
const stop = (rule: RuleId, ruleName: string, reason: string): Decision => ({ outcome: 'stopped', rule, ruleName, title: STOPPED, reason });

/** The first rule that fails decides. An approval answers only the ask rule, never a hard rule. */
export function decide(m: Mandate, p: Purchase, spentCents: number, approved = false): Decision {
  if (m.revoked) return stop('revoked', 'Mandate revoked', 'You revoked this mandate.');
  if (!p.signed) return stop('unknown', 'Unknown agent', 'This AI agent has no signed key at Nexi.');
  if (!m.shops.includes(p.shop)) return stop('shop', 'Shop not allowed', `${p.shop} is not on your list of shops.`);
  if (m.hoursOnly && (!p.weekday || p.hour < 8 || p.hour >= 20)) return stop('hours', 'Outside hours', 'Your mandate allows payments on weekdays, 08:00 to 20:00.');
  if (p.cents > m.limitCents) return stop('limit', 'Limit per purchase', `The price is ${eur(p.cents)}. Your limit is ${eur(m.limitCents)}.`);
  if (spentCents + p.cents > m.weeklyCents) return stop('weekly', 'Weekly budget', `This payment takes the week to ${eur(spentCents + p.cents)}. Your budget is ${eur(m.weeklyCents)}.`);
  if (m.askAboveCents !== null && p.cents > m.askAboveCents && !approved) {
    return { outcome: 'ask', rule: 'ask', ruleName: 'Ask me first', title: 'Waiting for you.', reason: `The price is ${eur(p.cents)}. You asked to approve payments above ${eur(m.askAboveCents)}.` };
  }
  return { outcome: 'paid', rule: 'ok', ruleName: approved ? 'Approved by you' : 'All rules passed', title: 'Paid.', reason: `The price is ${eur(p.cents)}. All rules in your mandate passed.` };
}

export type Token = { id: string; shop: string; cents: number; validMinutes: number };

/** A mock one-time token: one shop, one amount, valid for 10 minutes. */
export function issueToken(shop: string, cents: number, seed: number): Token {
  let hash = 2166136261 ^ seed;
  for (const ch of `${shop}:${cents}`) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  return { id: `TK-${(hash >>> 0).toString(16).toUpperCase().padStart(8, '0')}`, shop, cents, validMinutes: 10 };
}

export type PriceCheck = { position: number; multiple: number; high: boolean; text: string };

/** Where a price sits against the usual range for this item. */
export function priceCheck(cents: number, low: number, high: number, offers: number): PriceCheck {
  const middle = (low + high) / 2;
  const multiple = cents / middle;
  const position = Math.min(1, Math.max(0, (cents - low) / (high - low) / 2 + 0.25));
  const isHigh = cents > high;
  const size = multiple >= 10 ? Math.round(multiple) : Math.round(multiple * 10) / 10;
  const text = isHigh
    ? `${size}× the usual price. Usual range ${eur(low)} to ${eur(high)}, ${offers} offers compared.`
    : `Usual range ${eur(low)} to ${eur(high)}, ${offers} offers compared.`;
  return { position, multiple, high: isHigh, text };
}
