export type PaymentMode = "nexi-sandbox" | "stripe-sandbox" | "simulation";

export type Decision = "allow" | "block" | "request_approval";

export type PaymentState =
  | "proposed"
  | "blocked"
  | "processing"
  | "requires_action"
  | "authorized"
  | "executed"
  | "failed"
  | "unknown";

export type RuleCode =
  | "agent_relationship"
  | "mandate_active"
  | "mandate_version_current"
  | "mandate_not_expired"
  | "one_time_scope"
  | "offer_exists"
  | "offer_matches_server"
  | "amount_valid"
  | "currency_match"
  | "merchant_allowed"
  | "category_allowed"
  | "per_payment_limit"
  | "budget_remaining"
  | "balance_above_buffer"
  | "credit_forbidden";

export interface RuleResult {
  code: RuleCode;
  passed: boolean;
  explanation: string;
}

export interface PolicyResult {
  decision: Decision;
  rules: RuleResult[];
  projectedAvailableBalanceCents: number;
  projectedBudgetRemainingCents: number;
}

export interface MandateTerms {
  purpose: string;
  allowedCategories: string[];
  budgetCents: number;
  perPaymentLimitCents: number;
  minimumAvailableBalanceCents: number;
  allowedMerchantIds: string[];
  creditAllowed: boolean;
  expiresAt: string;
}

export interface MandateView extends MandateTerms {
  id: string;
  version: number;
  kind: "standing" | "one_time";
  ownerId: string;
  agentId: string;
  status: "active" | "revoked" | "expired";
  currency: "EUR";
  spentCents: number;
  reservedCents: number;
  grantedBy: string;
  grantedAt: string;
}

export interface MerchantView {
  id: string;
  name: string;
}

export interface OfferView {
  id: string;
  version: string;
  merchantId: string;
  merchantName: string;
  category: string;
  label: string;
  amountCents: number;
  currency: "EUR";
  eligible: boolean;
  eligibilityReason: string;
  selected: boolean;
}

export type AgentScenario = "weekly_basket" | "pharmacy_refill" | "next_basket";

export interface ProposalView {
  id: string;
  scenario: AgentScenario;
  mandateVersion: number;
  merchantId: string;
  merchantName: string;
  label: string;
  amountCents: number;
  decision: Decision;
  policy: PolicyResult;
  humanResolution: "none" | "kept_rules" | "regranted";
  createdAt: string;
}

export interface PaymentView {
  id: string;
  proposalId: string;
  state: PaymentState;
  mode: PaymentMode;
  amountCents: number;
  merchantName: string;
  providerReference: string | null;
  bindingHash: string;
  mandateVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEventView {
  id: number;
  actor: "human" | "agent" | "gate" | "provider" | "simulator";
  type: string;
  summary: string;
  createdAt: string;
}

export interface RegrantQuote {
  proposalId: string;
  amountCents: number;
  protectedShortfallCents: number;
  budgetOverrunCents: number;
  newMinimumAvailableBalanceCents: number;
  newBudgetCents: number;
}

export interface DemoState {
  sessionId: string;
  mode: PaymentMode;
  planner: "deterministic";
  offersAreSynthetic: true;
  ownerName: string;
  availableBalanceCents: number;
  reachCents: number;
  protectedShortfallCents: number;
  oneTimeExceptionCount: number;
  period: number;
  mandate: MandateView | null;
  merchants: MerchantView[];
  offers: OfferView[];
  proposals: ProposalView[];
  payments: PaymentView[];
  audit: AuditEventView[];
  pendingException: ProposalView | null;
  regrantQuote: RegrantQuote | null;
}

export type AttackName =
  | "tampered_price"
  | "swapped_merchant"
  | "replay"
  | "double_spend"
  | "agent_self_regrant"
  | "pay_after_revoke"
  | "forged_callback";

export type Guardrail =
  | "mandate_enforcement"
  | "offer_binding"
  | "duplicate_protection"
  | "revocation"
  | "credential_isolation"
  | "verified_outcome";

export interface AttackResult {
  name: AttackName;
  guardrail: Guardrail;
  stopped: boolean;
  summary: string;
  providerCalls: number;
  evidence: unknown;
}

export interface ApiError {
  error: string;
  message: string;
}
