// Spending limit: Nexi checks every payment from an AI assistant before the money moves.

export type Rules = { on: boolean; limitCents: number };

export type Result = { allowed: boolean; title: string; reason: string };

export const eur = (cents: number) => `€${(cents / 100).toFixed(2)}`;

export function check(rules: Rules, priceCents: number): Result {
  if (!rules.on) {
    return { allowed: false, title: 'Stopped. No money moved.', reason: 'You turned off the assistant.' };
  }
  const facts = `The price is ${eur(priceCents)}. Your limit is ${eur(rules.limitCents)}.`;
  if (priceCents > rules.limitCents) return { allowed: false, title: 'Stopped. No money moved.', reason: facts };
  return { allowed: true, title: 'Paid.', reason: facts };
}
