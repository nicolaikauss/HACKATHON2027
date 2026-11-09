import type { AgentScenario, MandateTerms, OfferView, PaymentView, ProposalView } from "../lib/contracts";

// Internal commands and provider transport types absent from the shared UI contracts.
export interface Principal { kind: "human" | "agent"; sessionId: string }
export interface ProposalInput {
  scenario: AgentScenario;
  idempotencyKey: string;
  agentId: string;
  mandateVersion: number;
  offerId: string;
  offerVersion: string;
  merchantId: string;
  amountCents: number;
  currency: string;
  fundingType: "debit" | "credit";
}
export interface Submission { proposal: ProposalView; payment: PaymentView | null; replayed: boolean }
export interface BeginResult { started: boolean; payment: PaymentView }
export type GrantOverrides = Partial<Pick<MandateTerms, "budgetCents" | "perPaymentLimitCents" | "minimumAvailableBalanceCents">> & { expiryDays?: number };
export interface PlannerContext {
  agentId: string;
  mandateVersion: number;
  mandateStatus: string;
  period: number;
  offers: OfferView[];
}
export type ProviderState = "authorized" | "executed" | "failed" | "requires_action" | "unknown";
export interface ProviderEvent {
  eventId: string;
  reference: string;
  amountCents: number;
  currency: "EUR";
  bindingHash: string;
  state: ProviderState;
}
export interface PaymentRequest {
  reference: string;
  amountCents: number;
  currency: "EUR";
  bindingHash: string;
}
