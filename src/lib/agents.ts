// Orders from buyer agents, and the shop's own merchant agent.
import type { Deal } from '../data/examples';
import { eur } from './guard';

export type IncomingOrder = { agent: string; qty: number; signed: boolean; bankAuthorised: boolean };

export function settle(order: IncomingOrder) {
  if (!order.signed) return { accepted: false, reason: 'Agent not signed' };
  if (!order.bankAuthorised) return { accepted: false, reason: 'Bank did not authorise' };
  return { accepted: true, reason: 'Accepted, paid' };
}

const AGENTS = ['LU-7F3A', 'GI-21C8', 'MA-90DE', 'SA-44B1', 'XX-0000', 'EL-6A72'];

export function incoming(seed: number): IncomingOrder[] {
  return AGENTS.map((agent, i) => ({
    agent,
    qty: 1 + ((seed + i * 3) % 4),
    signed: agent !== 'XX-0000',
    bankAuthorised: i !== 2,
  }));
}

export type Ask = { qty: number; maxCents: number };
export type Reply = { kind: 'bundle' | 'prepaid' | 'smaller' | 'accept' | 'decline'; qty: number; priceCents: number; text: string };

const MAX_DISCOUNT = 0.1;

/** Answers a buyer agent. Never above the buyer's maximum, and never more than 10% off. */
export function negotiate(deal: Deal, ask: Ask, unit: string): Reply {
  const floor = Math.ceil(deal.priceCents * (1 - MAX_DISCOUNT));
  if (ask.maxCents < floor) {
    return { kind: 'decline', qty: 0, priceCents: 0, text: `I cannot go below ${eur(floor)}. No deal, and no money moves.` };
  }
  const qty = Math.min(ask.qty, deal.available);
  const smaller = qty < ask.qty;
  if (!smaller && qty >= deal.bundleQty) {
    const bundle = Math.round(deal.priceCents * (1 - Math.min(deal.bundlePct, MAX_DISCOUNT)));
    const priceCents = Math.max(floor, Math.min(bundle, ask.maxCents));
    return { kind: 'bundle', qty, priceCents, text: `Bundle of ${qty} ${unit} at ${eur(priceCents)} each.` };
  }
  if (ask.maxCents < deal.priceCents) {
    return { kind: 'prepaid', qty, priceCents: ask.maxCents, text: `Pay now and I accept ${eur(ask.maxCents)} each for ${qty} ${unit}.` };
  }
  if (smaller) return { kind: 'smaller', qty, priceCents: deal.priceCents, text: `I have only ${qty} ${unit} left, at ${eur(deal.priceCents)} each.` };
  return { kind: 'accept', qty, priceCents: deal.priceCents, text: `Yes. ${qty} ${unit} at ${eur(deal.priceCents)} each.` };
}
