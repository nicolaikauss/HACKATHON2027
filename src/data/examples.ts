import type { Mandate, Purchase, RuleId } from '../lib/guard';
import type { Goods } from '../three/products';

export type Deal = { priceCents: number; bundleQty: number; bundlePct: number; available: number };

export type ShopExample = {
  id: string;
  label: string;
  goods: Goods;
  shop: string;
  area: string;
  lon: number;
  lat: number;
  side: 'left' | 'right';
  verb: string;
  unit: string;
  deal: Deal;
};

export const SHOP_EXAMPLES: ShopExample[] = [
  { id: 'bread', label: 'Bread', goods: 'bread', shop: 'Bakery', area: 'San Salvario', lon: 7.6835, lat: 45.0535, side: 'right', verb: 'Bake', unit: 'loaves', deal: { priceCents: 280, bundleQty: 6, bundlePct: 0.08, available: 30 } },
  { id: 'pastries', label: 'Pastries', goods: 'pastries', shop: 'Pastry shop', area: 'Centro', lon: 7.683, lat: 45.07, side: 'left', verb: 'Bake', unit: 'pastries', deal: { priceCents: 190, bundleQty: 12, bundlePct: 0.1, available: 40 } },
  { id: 'sandwiches', label: 'Sandwiches', goods: 'sandwiches', shop: 'Lunch bar', area: 'Crocetta', lon: 7.662, lat: 45.056, side: 'left', verb: 'Make', unit: 'sandwiches', deal: { priceCents: 650, bundleQty: 10, bundlePct: 0.07, available: 25 } },
  { id: 'fish', label: 'Fresh fish', goods: 'fish', shop: 'Fish stall', area: 'Porta Palazzo', lon: 7.6815, lat: 45.0775, side: 'left', verb: 'Order', unit: 'portions', deal: { priceCents: 1200, bundleQty: 4, bundlePct: 0.05, available: 15 } },
  { id: 'flowers', label: 'Flowers', goods: 'flowers', shop: 'Florist', area: 'Vanchiglia', lon: 7.7, lat: 45.072, side: 'right', verb: 'Order', unit: 'bunches', deal: { priceCents: 1500, bundleQty: 5, bundlePct: 0.1, available: 12 } },
];

export type LimitChoice = { label: string; shop: string; cents: number; hour?: number; signed?: boolean; expect: RuleId };

export type LimitExample = {
  id: string;
  label: string;
  goods: Goods;
  limit: number;
  weekly: number;
  spent: number;
  shops: string[];
  usual: [number, number];
  offers: number;
  askAbove: boolean;
  hoursOnly: boolean;
  choices: LimitChoice[];
};

export const ASK_ABOVE = 5000;

export const LIMIT_EXAMPLES: LimitExample[] = [
  { id: 'eggs', label: 'Eggs', goods: 'eggs', limit: 600, weekly: 3000, spent: 0, shops: ['Mercato Verde', 'FreshBasket'], usual: [320, 520], offers: 14, askAbove: false, hoursOnly: false, choices: [
    { label: 'Eggs', shop: 'Mercato Verde', cents: 438, expect: 'ok' },
    { label: 'Eggs, new shop', shop: 'QuickCrate', cents: 390, expect: 'shop' },
    { label: 'Eggs, fast delivery and tip', shop: 'FreshBasket', cents: 3143, expect: 'limit' },
  ] },
  { id: 'flowers', label: 'Birthday flowers', goods: 'flowers', limit: 9000, weekly: 15000, spent: 0, shops: ['Fiori Rossi', 'BloomBox'], usual: [3500, 7000], offers: 9, askAbove: true, hoursOnly: false, choices: [
    { label: 'Small bouquet', shop: 'Fiori Rossi', cents: 3400, expect: 'ok' },
    { label: 'Large bouquet', shop: 'BloomBox', cents: 6800, expect: 'ask' },
    { label: 'Gift set with vase', shop: 'BloomBox', cents: 12000, expect: 'limit' },
  ] },
  { id: 'medicine', label: 'Medicine', goods: 'medicine', limit: 1200, weekly: 4000, spent: 0, shops: ['Farmacia Centrale'], usual: [700, 1100], offers: 6, askAbove: false, hoursOnly: true, choices: [
    { label: 'Allergy tablets', shop: 'Farmacia Centrale', cents: 890, expect: 'ok' },
    { label: 'Same tablets, unknown website', shop: 'PillDirect', cents: 3900, expect: 'shop' },
    { label: 'Allergy tablets, at 23:40', shop: 'Farmacia Centrale', cents: 890, hour: 23, expect: 'hours' },
  ] },
  { id: 'train', label: 'Train ticket', goods: 'ticket', limit: 3000, weekly: 8000, spent: 0, shops: ['RailItalia'], usual: [1100, 1800], offers: 5, askAbove: false, hoursOnly: false, choices: [
    { label: 'Regional train to Milano', shop: 'RailItalia', cents: 1320, expect: 'ok' },
    { label: 'First class, flexible ticket', shop: 'RailItalia', cents: 6400, expect: 'limit' },
    { label: 'Regional train, agent not signed', shop: 'RailItalia', cents: 1320, signed: false, expect: 'unknown' },
  ] },
  { id: 'phone', label: 'Phone plan', goods: 'phone', limit: 1000, weekly: 1600, spent: 800, shops: ['TelMobile'], usual: [700, 1000], offers: 7, askAbove: false, hoursOnly: false, choices: [
    { label: 'Your phone plan', shop: 'TelMobile', cents: 799, expect: 'ok' },
    { label: 'Bigger plan the agent chose', shop: 'TelMobile', cents: 2499, expect: 'limit' },
    { label: 'Extra data pack', shop: 'TelMobile', cents: 950, expect: 'weekly' },
  ] },
];

export const startingMandate = (e: LimitExample): Mandate => ({
  revoked: false, limitCents: e.limit, weeklyCents: e.weekly, shops: e.shops, askAboveCents: e.askAbove ? ASK_ABOVE : null, hoursOnly: e.hoursOnly,
});
export const purchaseOf = (c: LimitChoice): Purchase => ({ shop: c.shop, cents: c.cents, signed: c.signed ?? true, hour: c.hour ?? 12, weekday: true });

export type PrivacyExample = {
  id: string;
  label: string;
  shop: string;
  person: string;
  budget: string;
  wants: string;
  seen: string;
  unit: string;
  demand: number;
  group: number;
  priceCents: number;
  askCount: string;
  askWho: string;
  askSmall: string;
  smallGroup: number;
};

export const PRIVACY_EXAMPLES: PrivacyExample[] = [
  { id: 'bakery', label: 'Bakery', shop: 'bakery', person: 'Giulia', budget: '€45 a week', wants: '2 loaves, Friday', seen: 'About 25 loaves wanted on Friday', unit: 'loaves', demand: 26, group: 184, priceCents: 280, askCount: 'How many loaves for Friday?', askWho: 'Who wants them?', askSmall: 'Only the 12 customers on Via Madama?', smallGroup: 12 },
  { id: 'pharmacy', label: 'Pharmacy', shop: 'pharmacy', person: 'Marco', budget: '€20 a month', wants: 'Allergy tablets', seen: 'About 40 boxes wanted next week', unit: 'boxes', demand: 41, group: 96, priceCents: 890, askCount: 'How many boxes for next week?', askWho: 'Who needs them?', askSmall: 'Only the 9 customers on Via Roma?', smallGroup: 9 },
  { id: 'clothes', label: 'Clothes shop', shop: 'clothes shop', person: 'Sara', budget: '€120 a season', wants: 'Winter coat, size M', seen: 'About 30 coats in size M wanted in October', unit: 'coats', demand: 31, group: 72, priceCents: 8900, askCount: 'How many coats in size M?', askWho: 'Who wants them?', askSmall: 'Only the 6 customers in my building?', smallGroup: 6 },
  { id: 'market', label: 'Supermarket', shop: 'supermarket', person: 'Elena', budget: '€80 a week', wants: 'Baby food, every week', seen: 'About 60 packs of baby food wanted this week', unit: 'packs', demand: 58, group: 140, priceCents: 420, askCount: 'How many packs this week?', askWho: 'Who is expecting a baby?', askSmall: 'Only the 3 customers on my street?', smallGroup: 3 },
];
