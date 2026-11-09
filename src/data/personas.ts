export type Persona = { name: string; role: string; need: string };

export const PERSONAS = {
  luca: { name: 'Luca, 24', role: 'Young retail bank customer', need: 'Wants an AI agent to pay for routine things, and wants to stay in control.' },
  merchant: { name: 'The merchant', role: 'From a bakery to an airline', need: 'Wants to know what to prepare, and to get paid for certain.' },
  analyst: { name: 'The market analyst', role: 'Marketing companies, consultancies and other third parties', need: 'Wants live demand across categories, with no personal data.' },
} satisfies Record<string, Persona>;
