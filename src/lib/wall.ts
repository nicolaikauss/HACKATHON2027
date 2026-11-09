// Live data, no names: the only path from customer data to anyone outside Nexi.
import type { PrivacyExample } from '../data/examples';
import { eur } from './guard';

export const MIN_GROUP = 50;

export type Question =
  | { id: string; text: string; kind: 'count'; group: number; amount: number; unit: string }
  | { id: string; text: string; kind: 'name' | 'money' }
  | { id: string; text: string; kind: 'small'; group: number };

export type Reply = { allowed: boolean; text: string; hides?: 'name' | 'money' };

const round5 = (n: number) => Math.round(n / 5) * 5;

/** One formula, so that every view shows the same number at the same moment. */
export function wantedNow(example: PrivacyExample, tick: number) {
  return example.demand + Math.round(Math.sin(tick * 0.9 + example.demand) * 2 + tick * 0.15);
}

export function questionsFor(example: PrivacyExample, amount = example.demand): Question[] {
  return [
    { id: 'count', text: example.askCount, kind: 'count', group: example.group, amount, unit: example.unit },
    { id: 'name', text: example.askWho, kind: 'name' },
    { id: 'money', text: 'How much can they spend?', kind: 'money' },
    { id: 'small', text: example.askSmall, kind: 'small', group: example.smallGroup },
  ];
}

export function reply(q: Question): Reply {
  if (!('group' in q)) {
    return { allowed: false, text: `Nexi does not share ${q.kind === 'name' ? 'names' : 'budgets'}.`, hides: q.kind };
  }
  if (q.group < MIN_GROUP) return { allowed: false, text: `This group is too small. Nexi needs ${MIN_GROUP} customers or more.` };
  if (q.kind === 'count') return { allowed: true, text: `About ${round5(q.amount)} ${q.unit}.` };
  return { allowed: false, text: 'Nexi cannot answer this question.' };
}

export type BundleField = { label: string; value: string };
export type Bundle = { party: string; channel: string; refresh: string; fields: BundleField[] };

const speed = (e: PrivacyExample, tick: number) => Math.round(e.group / 12 + Math.sin(tick * 0.6) * 2);
const change = (e: PrivacyExample) => ((e.demand * 7) % 11) - 4;
const signed = (n: number) => `${n >= 0 ? '+' : ''}${n}%`;

export function bundles(e: PrivacyExample, tick: number): Bundle[] {
  const wanted = `${wantedNow(e, tick)} ${e.unit}`;
  return [
    { party: 'Shop', channel: 'Included in the merchant app', refresh: 'Every hour', fields: [{ label: 'Units wanted', value: wanted }] },
    { party: 'Bank', channel: 'Merchant finance package, for partner banks', refresh: 'Every day', fields: [
      { label: 'Units wanted', value: wanted },
      { label: 'Expected sales', value: eur(wantedNow(e, tick) * e.priceCents) },
    ] },
    { party: 'Market analyst', channel: 'B2B package, sold through partner banks', refresh: 'Every 15 minutes', fields: [
      { label: 'Units wanted', value: wanted },
      { label: 'Buying speed', value: `${speed(e, tick)} orders an hour` },
      { label: 'Average price', value: eur(e.priceCents) },
      { label: 'Price against last week', value: signed(change(e)) },
      { label: 'Customers counted', value: String(e.group) },
    ] },
  ];
}

export function categories(list: PrivacyExample[], tick: number) {
  return list.filter((e) => e.group >= MIN_GROUP).map((e) => ({
    id: e.id, label: e.label, wanted: `${wantedNow(e, tick)} ${e.unit}`, speed: `${speed(e, tick)} orders an hour`, price: eur(e.priceCents), trend: signed(change(e)), customers: e.group,
  }));
}
