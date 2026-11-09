import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import type { AttackName, RuleCode } from "../src/lib/contracts";
import { fixture } from "./helpers";
import type { ProposalInput } from "../src/server/types";

let f: Awaited<ReturnType<typeof fixture>>;
beforeEach(async () => { f = await fixture(); });
afterEach(async () => { await f?.close(); });
const failures = (rules: { code: RuleCode; passed: boolean }[]) => rules.filter(r => !r.passed).map(r => r.code);
async function proposal(overrides: Partial<ProposalInput> = {}) {
  return { ...await f.backend.plan(f.agent, "weekly_basket"), idempotencyKey: randomUUID(), ...overrides };
}
async function reserve(overrides: Partial<ProposalInput> = {}) {
  return f.backend.submitProposal(f.agent, await proposal(overrides));
}
async function event(paymentId: string, state: "authorized" | "requires_action" | "unknown" | "executed" | "failed", extra = {}) {
  const payment = (await f.backend.state(f.human.sessionId)).payments.find(p => p.id === paymentId)!;
  const raw = JSON.stringify({ eventId: randomUUID(), reference: payment.providerReference, amountCents: payment.amountCents, currency: "EUR", bindingHash: payment.bindingHash, state, ...extra });
  return { raw, response: await f.backend.webhook(raw, f.provider.sign(raw)) };
}

test("full six-step demo exactly matches the specified money and rule outcomes", async () => {
  let s = await f.backend.state(f.human.sessionId);
  expect([s.availableBalanceCents, s.mandate!.budgetCents - s.mandate!.spentCents, s.reachCents]).toEqual([28000,6500,6500]);
  expect(s.mandate).toMatchObject({ version: 1, status: "active", kind: "standing", minimumAvailableBalanceCents: 20000, creditAllowed: false });
  expect((await f.backend.plan(f.agent, "weekly_basket")).offerId).toBe("offer-a");
  s = await f.backend.run(f.agent, "weekly_basket");
  expect([s.availableBalanceCents, s.mandate!.budgetCents - s.mandate!.spentCents, s.reachCents]).toEqual([22200,700,700]);
  expect(s.payments[0].state).toBe("executed");
  const calls = f.provider.providerCalls;
  s = await f.backend.run(f.agent, "pharmacy_refill");
  expect(f.provider.providerCalls).toBe(calls);
  expect(s.pendingException!.decision).toBe("request_approval");
  expect(failures(s.pendingException!.policy.rules)).toEqual(["budget_remaining","balance_above_buffer"]);
  expect(s.pendingException!.policy.rules).toHaveLength(15);
  expect(s.regrantQuote).toMatchObject({ protectedShortfallCents: 300, budgetOverrunCents: 1800, newMinimumAvailableBalanceCents: 19700, newBudgetCents: 8300 });
  s = await f.backend.regrant(f.human, s.pendingException!.id);
  expect(s.mandate).toMatchObject({version: 2, kind: "one_time", budgetCents: 8300, minimumAvailableBalanceCents: 19700});
  s = await f.backend.run(f.agent, "pharmacy_refill");
  expect([s.availableBalanceCents, Math.max(0,s.mandate!.budgetCents-s.mandate!.spentCents),s.reachCents,s.protectedShortfallCents]).toEqual([19700,0,0,300]);
  expect(s.mandate).toMatchObject({version: 3, kind: "standing", budgetCents: 6500, minimumAvailableBalanceCents: 20000});
  expect(s.proposals.find(p => p.humanResolution === "regranted")).toBeDefined();
  s = await f.backend.nextWeek(f.human.sessionId);
  expect([s.availableBalanceCents,s.mandate!.spentCents,s.reachCents,s.period]).toEqual([31700,0,6500,2]);
  await f.backend.revoke(f.human);
  const previousCalls = f.provider.providerCalls;
  s = await f.backend.run(f.agent,"next_basket");
  expect([s.availableBalanceCents,s.reachCents]).toEqual([31700,0]);
  expect(failures(s.proposals[0].policy.rules)).toEqual(["mandate_active"]);
  expect(f.provider.providerCalls).toBe(previousCalls);
});

describe("every rule is enforced against server data", () => {
  test.each([
    [{offerId:"offer-c",merchantId:"spesa-lampo",amountCents:5400},"merchant_allowed"],
    [{merchantId:"spesa-lampo"},"offer_matches_server"],
    [{amountCents:100},"offer_matches_server"],
    [{fundingType:"credit"},"credit_forbidden"],
    [{amountCents:0},"amount_valid"],
    [{amountCents:-1},"amount_valid"],
    [{currency:"USD"},"currency_match"],
    [{mandateVersion:0},"mandate_version_current"],
    [{agentId:"00000000-0000-0000-0000-000000000000"},"agent_relationship"],
    [{offerVersion:"999"},"offer_exists"],
  ] as [Partial<ProposalInput>,RuleCode][])("blocks %j with %s", async (change, code) => {
    const r = await reserve(change);
    expect(r.proposal.decision).toBe("block");
    expect(failures(r.proposal.policy.rules)).toContain(code);
    expect(r.proposal.policy.rules).toHaveLength(15);
    expect(r.payment).toBeNull();
    expect(f.provider.providerCalls).toBe(0);
  });
  test("expiry and revocation block independently", async () => {
    await f.pg.query("update nexi.mandate_versions set terms=jsonb_set(terms,'{expiresAt}',to_jsonb((now()-interval '1 day')::text)) where session_id=$1",[f.human.sessionId]);
    expect(failures((await reserve()).proposal.policy.rules)).toContain("mandate_not_expired");
    expect((await f.backend.state(f.human.sessionId)).reachCents).toBe(0);
    await f.backend.revoke(f.human);
    expect(failures((await reserve()).proposal.policy.rules)).toContain("mandate_active");
  });
  test("category and per-payment limits use stored terms", async () => {
    const input = await proposal();
    await f.pg.query("update nexi.mandate_versions set terms=terms || '{\"allowedCategories\":[],\"perPaymentLimitCents\":100}'::jsonb where session_id=$1",[f.human.sessionId]);
    const r = await f.backend.submitProposal(f.agent,input);
    expect(failures(r.proposal.policy.rules)).toEqual(["category_allowed","per_payment_limit"]);
  });
});

test("same request replays while changed data conflicts, including concurrent duplicate keys", async () => {
  const input = await proposal();
  const first = await f.backend.submitProposal(f.agent,input);
  const replay = await f.backend.submitProposal(f.agent,input);
  expect(replay.replayed).toBe(true);
  expect(replay.proposal.id).toBe(first.proposal.id);
  await expect(f.backend.submitProposal(f.agent,{...input,amountCents:100})).rejects.toMatchObject({code:"idempotency_conflict"});
  await Promise.all([f.backend.execute(f.agent.sessionId,first.payment!.id),f.backend.execute(f.agent.sessionId,replay.payment!.id)]);
  expect(f.provider.providerCalls).toBe(1);
  expect((await f.backend.state(f.agent.sessionId)).payments).toHaveLength(1);
});

test("reservations include budget and buffer and the binding hashes exact server fields", async () => {
  const first = await reserve();
  const second = await reserve();
  expect(first.proposal.decision).toBe("allow");
  expect(second.proposal.decision).toBe("request_approval");
  expect(failures(second.proposal.policy.rules)).toEqual(["budget_remaining","balance_above_buffer"]);
  const s = await f.backend.state(f.human.sessionId);
  expect([s.availableBalanceCents,s.mandate!.reservedCents,s.reachCents]).toEqual([28000,5800,700]);
  expect(first.payment!.bindingHash).toBe(createHash("sha256").update(`${first.proposal.id}|dispensa-nord|5800|EUR|offer-a|1|1`).digest("hex"));
  expect(f.provider.providerCalls).toBe(0);
  await expect(f.backend.nextWeek(f.human.sessionId)).rejects.toMatchObject({code:"payments_pending"});
});

test.each(["authorized","requires_action","unknown"] as const)("%s holds reservation; failed releases it without settlement",async state => {
  const r = await reserve();
  await f.db.call("api_begin_submission",{sessionId:f.agent.sessionId,paymentId:r.payment!.id});
  expect((await event(r.payment!.id,state)).response.status).toBe(200);
  let s = await f.backend.state(f.human.sessionId);
  expect([s.availableBalanceCents,s.mandate!.reservedCents,s.mandate!.spentCents]).toEqual([28000,5800,0]);
  await event(r.payment!.id,"failed");
  s = await f.backend.state(f.human.sessionId);
  expect([s.availableBalanceCents,s.mandate!.reservedCents,s.mandate!.spentCents]).toEqual([28000,0,0]);
});

test("callbacks reject tampering and forged signatures; duplicate and late events never settle twice", async () => {
  const r = await reserve();
  await f.db.call("api_begin_submission",{sessionId:f.agent.sessionId,paymentId:r.payment!.id});
  expect((await event(r.payment!.id,"executed",{amountCents:1})).response.status).toBe(409);
  expect((await event(r.payment!.id,"executed",{bindingHash:"00".repeat(32)})).response.status).toBe(409);
  expect((await f.backend.webhook("{}","00".repeat(32))).status).toBe(401);
  expect((await f.backend.state(f.human.sessionId)).payments[0].state).toBe("processing");
  const e = await event(r.payment!.id,"executed");
  expect(e.response.status).toBe(200);
  expect((await f.backend.webhook(e.raw,f.provider.sign(e.raw))).status).toBe(200);
  await event(r.payment!.id,"authorized");
  const s = await f.backend.state(f.human.sessionId);
  expect([s.availableBalanceCents,s.mandate!.reservedCents,s.mandate!.spentCents,s.payments[0].state]).toEqual([22200,0,5800,"executed"]);
});

test.each(["revoke","expire","stale"])("%s between reservation and begin prevents the provider call",async action => {
  const r = await reserve();
  if(action==="revoke") await f.backend.revoke(f.human);
  if(action==="expire") await f.pg.query("update nexi.mandate_versions set terms=jsonb_set(terms,'{expiresAt}',to_jsonb((now()-interval '1 day')::text)) where session_id=$1",[f.human.sessionId]);
  if(action==="stale") await f.backend.grant(f.human);
  await f.backend.execute(f.agent.sessionId,r.payment!.id);
  const s = await f.backend.state(f.human.sessionId);
  expect(s.payments[0].state).toBe("blocked");
  expect(s.mandate!.reservedCents).toBe(0);
  expect(f.provider.providerCalls).toBe(0);
});

test.each(["executed","failed"] as const)("one-time scope is single use and restores standing terms after %s",async terminal => {
  await f.backend.run(f.agent,"weekly_basket");
  let s = await f.backend.run(f.agent,"pharmacy_refill");
  await f.backend.regrant(f.human,s.pendingException!.id);
  const wrong = await reserve();
  expect(failures(wrong.proposal.policy.rules)).toContain("one_time_scope");
  const input = await f.backend.plan(f.agent,"pharmacy_refill");
  const first = await f.backend.submitProposal(f.agent,input);
  const second = await f.backend.submitProposal(f.agent,{...input,idempotencyKey:randomUUID()});
  expect(first.proposal.decision).toBe("allow");
  expect(failures(second.proposal.policy.rules)).toContain("one_time_scope");
  await f.db.call("api_begin_submission",{sessionId:f.agent.sessionId,paymentId:first.payment!.id});
  await event(first.payment!.id,terminal);
  s = await f.backend.state(f.human.sessionId);
  expect(s.mandate).toMatchObject({version:3,kind:"standing",budgetCents:6500,minimumAvailableBalanceCents:20000});
});

test("human operations reject agent principals and executed payments survive revocation", async () => {
  for(const op of [()=>f.backend.grant(f.agent),()=>f.backend.regrant(f.agent,randomUUID()),()=>f.backend.keepRules(f.agent,randomUUID()),()=>f.backend.revoke(f.agent)]) {
    await expect(op()).rejects.toMatchObject({code:"human_required"});
  }
  const before = await f.backend.run(f.agent,"weekly_basket");
  const after = await f.backend.revoke(f.human);
  expect(after.payments).toEqual(before.payments);
});

test("timeout is unknown, retains funds, and is never automatically retried",async () => {
  const r = await reserve();
  await f.backend.execute(f.agent.sessionId,r.payment!.id,"timeout");
  await f.backend.execute(f.agent.sessionId,r.payment!.id);
  const s = await f.backend.state(f.human.sessionId);
  expect([s.payments[0].state,s.availableBalanceCents,s.mandate!.reservedCents,f.provider.providerCalls]).toEqual(["unknown",28000,5800,1]);
});

test.each(["tampered_price","swapped_merchant","replay","double_spend","agent_self_regrant","pay_after_revoke","forged_callback"] as AttackName[])("attack %s is stopped with real evidence and leaves main session untouched",async name => {
  const before = await f.backend.state(f.human.sessionId);
  const result = await f.backend.attack(name);
  expect(result.stopped).toBe(true);
  expect(result.evidence).toBeDefined();
  expect(result.providerCalls).toBe(name==="replay" || name==="double_spend" ? 1 : 0);
  expect(await f.backend.state(f.human.sessionId)).toEqual(before);
});

test.each(["audit_events","ledger_entries"])("%s rejects updates and deletes",async table => {
  await reserve();
  await expect(f.pg.exec(`update nexi.${table} set created_at=now()`)).rejects.toThrow(/append_only/);
  await expect(f.pg.exec(`delete from nexi.${table}`)).rejects.toThrow(/append_only/);
});
