import "server-only";
import type { AgentScenario, AttackName, DemoState } from "../lib/contracts";
import type { ApiFunction, DatabaseExecutor } from "./db";
import type { GrantOverrides, PlannerContext, Principal, ProposalInput, Submission } from "./types";
import { normalizeError } from "./errors";
import { requireAgent, requireHuman } from "./principals";
import { planProposal } from "./planner";
import { executePayment } from "./executor";
import { verifiedProviderHandler } from "./payments";
import type { PaymentAdapter } from "./payments";
import { runAttack } from "./attacks";

export function createBackend(db: DatabaseExecutor, provider: PaymentAdapter) {
  async function call<T>(name: ApiFunction, input: unknown): Promise<T> {
    try { return await db.call<T>(name,input); } catch(error) { throw normalizeError(error); }
  }
  const backend = {
    createSession: () => call<DemoState>("api_create_session",{}),
    state: (sessionId: string) => call<DemoState>("api_state",{sessionId}),
    async grant(principal: Principal, overrides: GrantOverrides = {}) {
      requireHuman(principal);
      return call<DemoState>("api_human_grant",{sessionId:principal.sessionId,overrides});
    },
    async regrant(principal: Principal, proposalId: string) {
      requireHuman(principal);
      return call<DemoState>("api_human_regrant",{sessionId:principal.sessionId,proposalId});
    },
    async keepRules(principal: Principal, proposalId: string) {
      requireHuman(principal);
      return call<DemoState>("api_human_keep_rules",{sessionId:principal.sessionId,proposalId});
    },
    async revoke(principal: Principal) {
      requireHuman(principal);
      return call<DemoState>("api_human_revoke",{sessionId:principal.sessionId});
    },
    nextWeek: (sessionId: string) => call<DemoState>("api_next_week",{sessionId}),
    async eligibleOffers(principal: Principal, scenario: AgentScenario) {
      requireAgent(principal);
      return call<PlannerContext>("api_agent_context",{sessionId:principal.sessionId,scenario});
    },
    async plan(principal: Principal, scenario: AgentScenario) {
      return planProposal(await backend.eligibleOffers(principal,scenario),scenario);
    },
    async submitProposal(principal: Principal, input: ProposalInput) {
      requireAgent(principal);
      return call<Submission>("api_submit_proposal",{...input,sessionId:principal.sessionId});
    },
    execute: (sessionId: string, paymentId: string, scenario?: "timeout") => executePayment(db,provider,sessionId,paymentId,scenario),
    async run(principal: Principal, scenario: AgentScenario) {
      const result = await backend.submitProposal(principal,await backend.plan(principal,scenario));
      if (!result.replayed && result.payment) await backend.execute(principal.sessionId,result.payment.id);
      return backend.state(principal.sessionId);
    },
    webhook: (raw: string, signature: string | null) => verifiedProviderHandler(db,provider,raw,signature),
    async attack(name: AttackName) {
      // Each attack has an independent provider counter as well as a separate session.
      const isolated = provider.isolated();
      return runAttack(createBackend(db,isolated),isolated,name);
    },
  };
  return backend;
}
export type Backend = ReturnType<typeof createBackend>;

// The agent receives only these tools, never the backend orchestrator or payment adapter.
export function agentTools(backend: Backend, principal: Principal) {
  requireAgent(principal);
  return {
    eligibleOffers: (scenario: AgentScenario) => backend.eligibleOffers(principal,scenario),
    submitProposal: (input: ProposalInput) => backend.submitProposal(principal,input),
  };
}
