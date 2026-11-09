import { afterEach, beforeEach, expect, test } from "vitest";
import { fixture } from "./helpers";
import { agentTools, createBackend } from "../src/server/backend";
import { createHttpHandlers } from "../src/server/http";
import type { DatabaseExecutor } from "../src/server/db";
import { SimulatedProvider } from "../src/server/payments";

let f: Awaited<ReturnType<typeof fixture>>;
beforeEach(async () => { f=await fixture(); });
afterEach(async () => { await f?.close(); });

test("state lists newest proposals first and identifies the chosen weekly offer for the UI",async () => {
  const first=await f.backend.run(f.agent,"weekly_basket");
  const second=await f.backend.run(f.agent,"pharmacy_refill");
  expect(second.proposals[0].scenario).toBe("pharmacy_refill");
  expect(second.proposals[1].id).toBe(first.proposals[0].id);
  expect(second.offers.filter(o=>o.selected).map(o=>o.id)).toEqual(["offer-a"]);
});

test("agent tool surface contains only reading offers and submitting proposals",async () => {
  const tools=agentTools(f.backend,f.agent);
  expect(Object.keys(tools).sort()).toEqual(["eligibleOffers","submitProposal"]);
  expect((await tools.eligibleOffers("weekly_basket")).offers.filter(o=>o.eligible).map(o=>o.id).sort()).toEqual(["offer-a","offer-b"]);
});

test("a repeated scenario after a period advance uses a new key and no automatic retry",async () => {
  const before=await f.backend.plan(f.agent,"weekly_basket");
  await f.backend.run(f.agent,"weekly_basket");
  await f.backend.run(f.agent,"weekly_basket");
  expect(f.provider.providerCalls).toBe(1);
  await f.backend.nextWeek(f.human.sessionId);
  const after=await f.backend.plan(f.agent,"weekly_basket");
  expect(before.idempotencyKey).toBe("weekly_basket:v1:p1:active");
  expect(after.idempotencyKey).toBe("weekly_basket:v1:p2:active");
  await f.backend.run(f.agent,"weekly_basket");
  expect(f.provider.providerCalls).toBe(2);
});

test("one-time restoration after a post-begin revocation preserves revoked status",async () => {
  await f.backend.run(f.agent,"weekly_basket");
  const pending=await f.backend.run(f.agent,"pharmacy_refill");
  await f.backend.regrant(f.human,pending.pendingException!.id);
  const r=await f.backend.submitProposal(f.agent,await f.backend.plan(f.agent,"pharmacy_refill"));
  await f.db.call("api_begin_submission",{sessionId:f.human.sessionId,paymentId:r.payment!.id});
  await f.backend.revoke(f.human);
  const raw=JSON.stringify({eventId:"post-revocation",reference:r.payment!.providerReference,bindingHash:r.payment!.bindingHash,amountCents:2500,currency:"EUR",state:"executed"});
  expect((await f.backend.webhook(raw,f.provider.sign(raw))).status).toBe(200);
  const s=await f.backend.state(f.human.sessionId);
  expect(s.mandate).toMatchObject({version:3,kind:"standing",status:"revoked",reservedCents:0});
  expect([s.availableBalanceCents,s.reachCents]).toEqual([19700,0]);
});

test("provider event ids cannot be reused with changed data or the wrong reference",async () => {
  const r=await f.backend.submitProposal(f.agent,await f.backend.plan(f.agent,"weekly_basket"));
  await f.db.call("api_begin_submission",{sessionId:f.human.sessionId,paymentId:r.payment!.id});
  const payload={eventId:"unique-provider-event",reference:r.payment!.providerReference,bindingHash:r.payment!.bindingHash,amountCents:5800,currency:"EUR",state:"authorized"};
  const send=(data: typeof payload) => {const raw=JSON.stringify(data);return f.backend.webhook(raw,f.provider.sign(raw));};
  expect((await send(payload)).status).toBe(200);
  expect((await send({...payload,state:"executed"})).status).toBe(409);
  expect((await send({...payload,eventId:"wrong-ref",reference:"unbound-reference"})).status).toBe(409);
  expect((await f.backend.state(f.human.sessionId)).availableBalanceCents).toBe(28000);
});

test("all HTTP exceptions become safe ApiError responses without database details",async () => {
  const db: DatabaseExecutor={async call(){throw new Error("password=private; host=secret.internal; sensitive SQL");}};
  const broken=createHttpHandlers(createBackend(db,new SimulatedProvider("test-key")));
  const r=await broken.state(new Request("http://localhost/api/state"));
  expect(r.status).toBe(500);
  expect(await r.json()).toEqual({error:"internal_error",message:"The operation could not be completed."});
});

test("HMAC covers exact raw bytes and accepts only fixed length hexadecimal signatures",async () => {
  const raw='{"message":"Elena’s synthetic payment"}';
  const signature=f.provider.sign(raw);
  expect(f.provider.verify(raw,signature)).toBe(true);
  for(const sig of [null,"",signature.slice(2),"x".repeat(64),signature+"00"]) expect(f.provider.verify(raw,sig)).toBe(false);
  expect(f.provider.verify(`${raw}\n`,signature)).toBe(false);
  expect((await f.backend.webhook("{",f.provider.sign("{"))).status).toBe(400);
});
