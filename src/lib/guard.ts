// Mandate rules: Nexi checks every AI agent payment before the money moves.

export const eur = (cents: number) => `€${(cents / 100).toFixed(2)}`;

export type Mandate = {
  revoked: boolean;
  limitCents: number;
  weeklyCents: number;
  shops: string[];
  askAboveCents: number | null;
  hoursOnly: boolean;
};

/** `cents` is the price of one item. The weekly budget and the ask rule use the total. */
export type Purchase = { shop: string; cents: number; qty?: number; signed: boolean; hour: number; weekday: boolean };
export type RuleId = 'revoked' | 'unknown' | 'shop' | 'hours' | 'limit' | 'weekly' | 'ask' | 'ok';
export type Decision = { outcome: 'paid' | 'stopped' | 'ask'; rule: RuleId; ruleName: string; title: string; reason: string };

/** The fixed order of the checks. The first check that fails decides. */
export const CHECKS = [
  { id: 'revoked', name: 'The mandate is active' },
  { id: 'unknown', name: 'The agent is signed' },
  { id: 'shop', name: 'The shop is allowed' },
  { id: 'hours', name: 'The time is allowed' },
  { id: 'limit', name: 'The price is inside the limit' },
  { id: 'weekly', name: 'The weekly budget is enough' },
  { id: 'ask', name: 'The owner approved, if asked' },
] as const satisfies readonly { id: RuleId; name: string }[];

export type CheckState = 'pass' | 'fail' | 'wait' | 'skip';

/** What each check did for a decision: passed, failed, waits for the owner, or was not reached. */
export function trace(rule: string, outcome: string): CheckState[] {
  const failed = CHECKS.findIndex((c) => c.id === rule);
  return CHECKS.map((_, i) => (failed < 0 || i < failed ? 'pass' : i > failed ? 'skip' : outcome === 'ask' ? 'wait' : 'fail'));
}

const STOPPED = 'Stopped. No money moved.';
const stop = (rule: RuleId, ruleName: string, reason: string): Decision => ({ outcome: 'stopped', rule, ruleName, title: STOPPED, reason });

/** An approval answers only the ask rule, never a hard rule. */
export function decide(m: Mandate, p: Purchase, spentCents: number, approved = false): Decision {
  const total = p.cents * (p.qty ?? 1);
  if (m.revoked) return stop('revoked', 'Mandate revoked', 'You revoked this mandate.');
  if (!p.signed) return stop('unknown', 'Unknown agent', 'This AI agent has no signed key at Nexi.');
  if (!m.shops.includes(p.shop)) return stop('shop', 'Shop not allowed', `${p.shop} is not on your list.`);
  if (m.hoursOnly && (!p.weekday || p.hour < 8 || p.hour >= 20)) return stop('hours', 'Outside hours', 'Your mandate allows payments on weekdays, 08:00 to 20:00.');
  if (p.cents > m.limitCents) return stop('limit', 'Price above the limit', `The price is ${eur(p.cents)}. Your limit is ${eur(m.limitCents)}.`);
  if (spentCents + total > m.weeklyCents) return stop('weekly', 'Weekly budget', `This payment takes the week to ${eur(spentCents + total)}. Your budget is ${eur(m.weeklyCents)}.`);
  if (m.askAboveCents !== null && total > m.askAboveCents && !approved) {
    return { outcome: 'ask', rule: 'ask', ruleName: 'Ask me first', title: 'Waiting for you.', reason: `This payment is ${eur(total)}. You asked to approve payments above ${eur(m.askAboveCents)}.` };
  }
  return { outcome: 'paid', rule: 'ok', ruleName: approved ? 'Approved by you' : 'All rules passed', title: 'Paid.', reason: `Paid ${eur(total)}. All rules passed.` };
}

/** A mock one-time token: one shop, one amount, valid for 10 minutes. The nonce makes each payment unique. */
export function issueToken(shop: string, cents: number, nonce: string | number) {
  let hash = 2166136261;
  for (const ch of `${shop}:${cents}:${nonce}`) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  return `TK-${(hash >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
}
