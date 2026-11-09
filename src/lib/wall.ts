// Numbers, not names: the only path from customer data to a shop.
import type { PrivacyExample } from '../data/examples';

export const MIN_GROUP = 50;

export type Question =
  | { id: string; text: string; kind: 'count'; group: number; amount: number; unit: string }
  | { id: string; text: string; kind: 'name' | 'money' }
  | { id: string; text: string; kind: 'small'; group: number };

export type Reply = { allowed: boolean; text: string; hides?: 'name' | 'money' };

export function questionsFor(example: PrivacyExample): Question[] {
  return [
    { id: 'count', text: example.askCount, kind: 'count', group: example.group, amount: example.demand, unit: example.unit },
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
  if (q.kind === 'count') return { allowed: true, text: `About ${Math.round(q.amount / 5) * 5} ${q.unit}.` };
  return { allowed: false, text: 'Nexi cannot answer this question.' };
}
