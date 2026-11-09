import type { Goods } from '../three/products';

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
};

export const SHOP_EXAMPLES: ShopExample[] = [
  { id: 'bread', label: 'Bread', goods: 'bread', shop: 'Bakery', area: 'San Salvario', lon: 7.6835, lat: 45.0535, side: 'right', verb: 'Bake', unit: 'loaves' },
  { id: 'pastries', label: 'Pastries', goods: 'pastries', shop: 'Pastry shop', area: 'Centro', lon: 7.683, lat: 45.07, side: 'left', verb: 'Bake', unit: 'pastries' },
  { id: 'sandwiches', label: 'Sandwiches', goods: 'sandwiches', shop: 'Lunch bar', area: 'Crocetta', lon: 7.662, lat: 45.056, side: 'left', verb: 'Make', unit: 'sandwiches' },
  { id: 'fish', label: 'Fresh fish', goods: 'fish', shop: 'Fish stall', area: 'Porta Palazzo', lon: 7.6815, lat: 45.0775, side: 'left', verb: 'Order', unit: 'portions' },
  { id: 'flowers', label: 'Flowers', goods: 'flowers', shop: 'Florist', area: 'Vanchiglia', lon: 7.7, lat: 45.072, side: 'right', verb: 'Order', unit: 'bunches' },
];

export type LimitExample = {
  id: string;
  label: string;
  goods: Goods;
  limit: number;
  fair: { label: string; cents: number };
  extra: { label: string; cents: number };
};

export const LIMIT_EXAMPLES: LimitExample[] = [
  { id: 'eggs', label: 'Eggs', goods: 'eggs', limit: 600, fair: { label: 'Eggs', cents: 438 }, extra: { label: 'Eggs, fast delivery and tip', cents: 3143 } },
  { id: 'train', label: 'Train ticket', goods: 'ticket', limit: 3000, fair: { label: 'Regional train to Milano', cents: 1320 }, extra: { label: 'First class, flexible ticket', cents: 6400 } },
  { id: 'medicine', label: 'Medicine', goods: 'medicine', limit: 1200, fair: { label: 'Allergy tablets', cents: 890 }, extra: { label: 'Same tablets, unknown website', cents: 3900 } },
  { id: 'phone', label: 'Phone plan', goods: 'phone', limit: 1000, fair: { label: 'Your phone plan', cents: 799 }, extra: { label: 'Bigger plan the assistant chose', cents: 2499 } },
];

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
  askCount: string;
  askWho: string;
  askSmall: string;
  smallGroup: number;
};

export const PRIVACY_EXAMPLES: PrivacyExample[] = [
  { id: 'bakery', label: 'Bakery', shop: 'bakery', person: 'Giulia', budget: '€45 a week', wants: '2 loaves, Friday', seen: 'About 25 loaves wanted on Friday', unit: 'loaves', demand: 26, group: 184, askCount: 'How many loaves for Friday?', askWho: 'Who wants them?', askSmall: 'Only the 12 customers on Via Madama?', smallGroup: 12 },
  { id: 'pharmacy', label: 'Pharmacy', shop: 'pharmacy', person: 'Marco', budget: '€20 a month', wants: 'Allergy tablets', seen: 'About 40 boxes wanted next week', unit: 'boxes', demand: 41, group: 96, askCount: 'How many boxes for next week?', askWho: 'Who needs them?', askSmall: 'Only the 9 customers on Via Roma?', smallGroup: 9 },
  { id: 'clothes', label: 'Clothes shop', shop: 'clothes shop', person: 'Sara', budget: '€120 a season', wants: 'Winter coat, size M', seen: 'About 30 coats in size M wanted in October', unit: 'coats', demand: 31, group: 72, askCount: 'How many coats in size M?', askWho: 'Who wants them?', askSmall: 'Only the 6 customers in my building?', smallGroup: 6 },
  { id: 'market', label: 'Supermarket', shop: 'supermarket', person: 'Elena', budget: '€80 a week', wants: 'Baby food, every week', seen: 'About 60 packs of baby food wanted this week', unit: 'packs', demand: 58, group: 140, askCount: 'How many packs this week?', askWho: 'Who is expecting a baby?', askSmall: 'Only the 3 customers on my street?', smallGroup: 3 },
];
