import type { AgentScenario } from "../lib/contracts";
import type { PlannerContext, ProposalInput } from "./types";
import { GateError } from "./errors";

// Deterministic script, not an LLM. Eligibility is computed by the database.
export function planProposal(context: PlannerContext, scenario: AgentScenario): ProposalInput {
  const offer = context.offers.filter(o => o.eligible).sort((a,b) => a.amountCents-b.amountCents || a.id.localeCompare(b.id))[0];
  if (!offer) throw new GateError("no_eligible_offer");
  return {
    scenario, idempotencyKey: `${scenario}:v${context.mandateVersion}:p${context.period}:${context.mandateStatus}`,
    agentId: context.agentId, mandateVersion: context.mandateVersion,
    offerId: offer.id, offerVersion: offer.version, merchantId: offer.merchantId,
    amountCents: offer.amountCents, currency: offer.currency, fundingType: "debit",
  };
}
