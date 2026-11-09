import { randomUUID } from "node:crypto";
import type { AttackName, AttackResult, Guardrail } from "../lib/contracts";
import type { Backend } from "./backend";
import type { PaymentAdapter } from "./payments";
import type { Submission } from "./types";
import { normalizeError } from "./errors";

export async function runAttack(backend: Backend, provider: PaymentAdapter, name: AttackName): Promise<AttackResult> {
  const session = await backend.createSession();
  const human = {kind:"human" as const,sessionId:session.sessionId};
  const agent = {kind:"agent" as const,sessionId:session.sessionId};
  await backend.grant(human);
  const input = await backend.plan(agent,"weekly_basket");
  const failed = (r: Submission, code: string) => r.proposal.policy.rules.some(rule=>rule.code===code && !rule.passed);
  let stopped = false;
  let evidence: unknown;
  let guardrail: Guardrail;
  let summary: string;
  switch(name) {
    case "tampered_price": case "swapped_merchant": {
      guardrail="offer_binding";
      const result = await backend.submitProposal(agent,{...input,...(name==="tampered_price"?{amountCents:100}:{merchantId:"spesa-lampo"})});
      stopped=result.proposal.decision==="block" && failed(result,"offer_matches_server") && provider.providerCalls===0;
      evidence=result; summary="The server offer rejected the altered claim before any provider call."; break;
    }
    case "replay": {
      guardrail="duplicate_protection";
      const first = await backend.submitProposal(agent,input);
      if(first.payment) await backend.execute(agent.sessionId,first.payment.id);
      const repeated = await backend.submitProposal(agent,input);
      const state = await backend.state(agent.sessionId);
      stopped=repeated.replayed && first.proposal.id===repeated.proposal.id && state.payments.length===1 && provider.providerCalls===1;
      evidence={first,repeated,payments:state.payments}; summary="The repeated key returned the original proposal and made one payment."; break;
    }
    case "double_spend": {
      guardrail="duplicate_protection";
      const results = await Promise.all([backend.submitProposal(agent,input),backend.submitProposal(agent,{...input,idempotencyKey:randomUUID()})]);
      for (const result of results) if(result.payment) await backend.execute(agent.sessionId,result.payment.id);
      stopped=results.filter(r=>r.proposal.decision==="allow").length===1 && results.some(r=>failed(r,"budget_remaining")) && provider.providerCalls===1;
      evidence=results; summary="Row locks serialized both proposals. The first reservation used the budget, so the second failed the budget check."; break;
    }
    case "agent_self_regrant": {
      guardrail="credential_isolation";
      try { await backend.regrant(agent,randomUUID()); }
      catch(error) { const safe=normalizeError(error); stopped=safe.code==="human_required"; evidence={error:safe.code}; }
      summary="The agent principal was refused by the human-only re-grant function."; break;
    }
    case "pay_after_revoke": {
      guardrail="revocation";
      const result=await backend.submitProposal(agent,input);
      await backend.revoke(human);
      if(result.payment) await backend.execute(agent.sessionId,result.payment.id);
      const state=await backend.state(agent.sessionId);
      stopped=state.payments[0]?.state==="blocked" && state.mandate?.reservedCents===0 && provider.providerCalls===0;
      evidence={payment:state.payments[0],reservedCents:state.mandate?.reservedCents}; summary="Revocation before submission blocked payment and released the reservation."; break;
    }
    case "forged_callback": {
      guardrail="verified_outcome";
      const result=await backend.submitProposal(agent,input);
      const raw=JSON.stringify({eventId:randomUUID(),reference:result.payment!.providerReference,amountCents:5800,currency:"EUR",bindingHash:result.payment!.bindingHash,state:"executed"});
      const response=await backend.webhook(raw,"00".repeat(32));
      const state=await backend.state(agent.sessionId);
      stopped=response.status===401 && state.payments[0].state==="proposed" && state.availableBalanceCents===28000;
      evidence={status:response.status,payment:state.payments[0]}; summary="The invalid HMAC was rejected with HTTP 401 and no payment change."; break;
    }
  }
  return {name,guardrail,stopped,summary,providerCalls:provider.providerCalls,evidence};
}
