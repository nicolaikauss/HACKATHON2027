import type {
  AgentScenario,
  AttackResult,
  AuditEventView,
  DemoState,
  MandateView,
  OfferView,
  PaymentView,
  ProposalView,
  RuleCode,
  RuleResult,
} from "./contracts";

export const uiPreview = process.env.NEXT_PUBLIC_UI_PREVIEW === "1";

const MERCHANTS = [
  { id: "dispensa-nord", name: "Dispensa Nord" },
  { id: "mercato-aurora", name: "Mercato Aurora" },
  { id: "farmacia-lumen", name: "Farmacia Lumen" },
];

const SCENARIOS: Record<AgentScenario, { merchantId: string; merchantName: string; label: string; amountCents: number }> = {
  weekly_basket: { merchantId: "dispensa-nord", merchantName: "Dispensa Nord", label: "Weekly essentials", amountCents: 5800 },
  pharmacy_refill: { merchantId: "farmacia-lumen", merchantName: "Farmacia Lumen", label: "Prescription refill", amountCents: 2500 },
  next_basket: { merchantId: "dispensa-nord", merchantName: "Dispensa Nord", label: "Weekly essentials", amountCents: 5200 },
};

const OFFERS: OfferView[] = [
  { id: "offer-a", version: "1", merchantId: "dispensa-nord", merchantName: "Dispensa Nord", category: "essentials", label: "Weekly essentials", amountCents: 5800, currency: "EUR", eligible: true, eligibilityReason: "Approved shop, cheapest eligible total", selected: true },
  { id: "offer-b", version: "1", merchantId: "mercato-aurora", merchantName: "Mercato Aurora", category: "essentials", label: "Weekly essentials", amountCents: 6100, currency: "EUR", eligible: true, eligibilityReason: "Approved shop, costs €3 more", selected: false },
  { id: "offer-c", version: "1", merchantId: "spesa-lampo", merchantName: "Spesa Lampo", category: "essentials", label: "Weekly essentials", amountCents: 5400, currency: "EUR", eligible: false, eligibilityReason: "Cheapest, but not one of your approved shops", selected: false },
];

const ALL_CODES: RuleCode[] = [
  "agent_relationship", "mandate_active", "mandate_version_current", "mandate_not_expired",
  "one_time_scope", "offer_exists", "offer_matches_server", "amount_valid", "currency_match",
  "merchant_allowed", "category_allowed", "per_payment_limit", "budget_remaining",
  "balance_above_buffer", "credit_forbidden",
];

const money = (c: number) => `€${(c / 100).toFixed(2)}`;
const now = () => new Date().toISOString();

let balance = 28000;
let mandate: MandateView | null = null;
let period = 0;
let exceptions = 0;
let seq = 0;
let proposals: ProposalView[] = [];
let payments: PaymentView[] = [];
let audit: AuditEventView[] = [];

function log(actor: AuditEventView["actor"], type: string, summary: string) {
  audit = [{ id: ++seq, actor, type, summary, createdAt: now() }, ...audit];
}

function reset() {
  balance = 28000;
  mandate = null;
  period = 0;
  exceptions = 0;
  proposals = [];
  payments = [];
  audit = [];
  log("simulator", "preview", "Preview session started. No gate or database is connected.");
}
reset();

function snapshot(): DemoState {
  const pendingException =
    proposals.find((p) => p.decision === "request_approval" && p.humanResolution === "none") ?? null;
  const m = mandate;
  const reachCents =
    m && m.status === "active"
      ? Math.max(0, Math.min(m.budgetCents - m.spentCents, m.perPaymentLimitCents, balance - m.minimumAvailableBalanceCents))
      : 0;
  return {
    sessionId: "ui-preview",
    mode: "simulation",
    planner: "deterministic",
    offersAreSynthetic: true,
    ownerName: "Elena",
    availableBalanceCents: balance,
    reachCents,
    protectedShortfallCents: m ? Math.max(0, m.minimumAvailableBalanceCents - balance) : 0,
    oneTimeExceptionCount: exceptions,
    period,
    mandate: m ? { ...m } : null,
    merchants: MERCHANTS,
    offers: OFFERS,
    proposals: [...proposals],
    payments: [...payments],
    audit: [...audit],
    pendingException,
    regrantQuote:
      pendingException && m
        ? {
            proposalId: pendingException.id,
            amountCents: pendingException.amountCents,
            protectedShortfallCents: Math.max(0, m.minimumAvailableBalanceCents - (balance - pendingException.amountCents)),
            budgetOverrunCents: Math.max(0, pendingException.amountCents - (m.budgetCents - m.spentCents)),
            newMinimumAvailableBalanceCents: balance - pendingException.amountCents,
            newBudgetCents: m.spentCents + pendingException.amountCents,
          }
        : null,
  };
}

function runAgent(scenario: AgentScenario) {
  if (!mandate) throw new Error("Grant authority first.");
  const s = SCENARIOS[scenario];
  const m = mandate;
  const left = m.budgetCents - m.spentCents;
  const after = balance - s.amountCents;
  const failed: Partial<Record<RuleCode, string>> = {};
  if (m.status !== "active") failed.mandate_active = "This authority was revoked by Elena";
  if (s.amountCents > left) failed.budget_remaining = `Weekly budget: needs ${money(s.amountCents)}, ${money(Math.max(0, left))} left`;
  if (after < m.minimumAvailableBalanceCents) failed.balance_above_buffer = `Protected money: would leave ${money(after)}, under your ${money(m.minimumAvailableBalanceCents)}`;

  const rules: RuleResult[] = ALL_CODES.map((code) => ({
    code,
    passed: !failed[code],
    explanation: failed[code] ?? `${code.replaceAll("_", " ")}: passed`,
  }));
  const codes = Object.keys(failed);
  const onlyHuman = codes.every((c) => c === "budget_remaining" || c === "balance_above_buffer");
  const decision = codes.length === 0 ? "allow" : onlyHuman ? "request_approval" : "block";
  const id = `preview-${++seq}`;
  proposals = [
    {
      id, scenario, mandateVersion: m.version, merchantId: s.merchantId, merchantName: s.merchantName,
      label: s.label, amountCents: s.amountCents, decision, humanResolution: "none", createdAt: now(),
      policy: { decision, rules, projectedAvailableBalanceCents: after, projectedBudgetRemainingCents: left - s.amountCents },
    },
    ...proposals,
  ];
  log("agent", "proposal", `Proposed ${s.merchantName}, ${money(s.amountCents)}`);
  log("gate", "decision", `Decision: ${decision.replace("_", " ")}`);
  if (decision !== "allow") return;

  balance = after;
  m.spentCents += s.amountCents;
  payments = [
    {
      id: `pay-${seq}`, proposalId: id, state: "executed", mode: "simulation", amountCents: s.amountCents,
      merchantName: s.merchantName, providerReference: `preview_${seq}`, bindingHash: "preview",
      mandateVersion: m.version, createdAt: now(), updatedAt: now(),
    },
    ...payments,
  ];
  log("provider", "executed", `Preview payment executed, ${money(s.amountCents)}`);
  if (m.kind === "one_time") {
    exceptions += 1;
    m.version += 1;
    m.kind = "standing";
    m.budgetCents = 6500;
    m.perPaymentLimitCents = 6500;
    m.minimumAvailableBalanceCents = 20000;
    log("gate", "restored", `One-time grant used. Standing terms restored as v${m.version}`);
  }
}

export function previewCall(url: string, body: Record<string, unknown> = {}): DemoState | AttackResult {
  switch (url) {
    case "/api/state":
      return snapshot();
    case "/api/demo/reset":
      reset();
      return snapshot();
    case "/api/human/grant":
      mandate = {
        id: "preview-mandate", version: 1, kind: "standing", ownerId: "elena", agentId: "essentials-agent",
        status: "active", currency: "EUR", spentCents: 0, reservedCents: 0, grantedBy: "Elena", grantedAt: now(),
        purpose: "Weekly household essentials", allowedCategories: ["essentials"],
        budgetCents: Number(body.budgetCents), perPaymentLimitCents: Number(body.perPaymentLimitCents),
        minimumAvailableBalanceCents: Number(body.minimumAvailableBalanceCents),
        allowedMerchantIds: MERCHANTS.map((x) => x.id), creditAllowed: false,
        expiresAt: new Date(Date.now() + 28 * 864e5).toISOString(),
      };
      log("human", "grant", "Elena granted mandate v1");
      return snapshot();
    case "/api/agent/run":
      runAgent(body.scenario as AgentScenario);
      return snapshot();
    case "/api/human/keep-rules":
      proposals = proposals.map((p) => (p.id === body.proposalId ? { ...p, humanResolution: "kept_rules" } : p));
      log("human", "kept_rules", "Elena kept her rules");
      return snapshot();
    case "/api/human/regrant": {
      const p = proposals.find((x) => x.id === body.proposalId);
      if (!p || !mandate) throw new Error("Nothing to re-grant.");
      proposals = proposals.map((x) => (x.id === p.id ? { ...x, humanResolution: "regranted" } : x));
      mandate.version += 1;
      mandate.kind = "one_time";
      mandate.budgetCents = mandate.spentCents + p.amountCents;
      mandate.minimumAvailableBalanceCents = balance - p.amountCents;
      log("human", "regrant", `Elena allowed this purchase once (v${mandate.version})`);
      return snapshot();
    }
    case "/api/human/revoke":
      if (mandate) mandate.status = "revoked";
      log("human", "revoke", "Elena revoked the authority");
      return snapshot();
    case "/api/demo/next-week":
      balance += 12000;
      period += 1;
      if (mandate) mandate.spentCents = 0;
      log("simulator", "next_week", "One week later: pay arrived, +€120.00");
      return snapshot();
    case "/api/demo/attack":
      throw new Error("Attacks need the real gate, which is not connected in this preview.");
    default:
      throw new Error(`No preview handler for ${url}`);
  }
}
