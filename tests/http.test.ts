import { afterEach, beforeEach, expect, test } from "vitest";
import { createHttpHandlers } from "../src/server/http";
import { fixture } from "./helpers";

let f: Awaited<ReturnType<typeof fixture>>;
beforeEach(async () => { f=await fixture(); });
afterEach(async () => { await f?.close(); });
const request = (body?: unknown, sessionId?: string, headers: Record<string,string> = {}) => new Request("http://localhost/api/test",{
  method:"POST",headers:{"Content-Type":"application/json",...(sessionId?{Cookie:`nac_session=${sessionId}`} : {}),...headers},
  body:body===undefined?undefined:JSON.stringify(body),
});

test("GET creates cookies for missing or unknown sessions and reset preserves old history",async () => {
  const h=createHttpHandlers(f.backend);
  for(const cookie of ["", "nac_session=00000000-0000-4000-8000-000000000000", "nac_session=bad"]) {
    const r=await h.state(new Request("https://example.test/api/state",{headers:{Cookie:cookie}}));
    expect(r.status).toBe(200);
    expect(r.headers.get("Set-Cookie")).toMatch(/nac_session=[a-f0-9-]+; Path=\/; HttpOnly; SameSite=Lax; Secure/);
    const s=await r.json();
    expect([s.availableBalanceCents,s.mandate,s.reachCents]).toEqual([28000,null,0]);
  }
  await f.backend.run(f.agent,"weekly_basket");
  const r=await h.reset(request(undefined,f.human.sessionId));
  expect((await r.json()).sessionId).not.toBe(f.human.sessionId);
  expect((await f.backend.state(f.human.sessionId)).payments[0].state).toBe("executed");
});

test("HTTP actions drive the full demo through validated human and agent boundaries",async () => {
  const h=createHttpHandlers(f.backend);
  const sid=f.human.sessionId;
  expect((await h.grant(request({},sid))).status).toBe(200);
  expect((await h.run(request({scenario:"weekly_basket"},sid))).status).toBe(200);
  const pharmacy=await (await h.run(request({scenario:"pharmacy_refill"},sid))).json();
  expect((await h.regrant(request({proposalId:pharmacy.pendingException.id},sid))).status).toBe(200);
  expect((await h.run(request({scenario:"pharmacy_refill"},sid))).status).toBe(200);
  expect((await h.nextWeek(request(undefined,sid))).status).toBe(200);
  expect((await h.revoke(request(undefined,sid))).status).toBe(200);
  const s=await (await h.state(new Request("http://localhost/api/state",{headers:{Cookie:`nac_session=${sid}`}}))).json();
  expect([s.availableBalanceCents,s.reachCents]).toEqual([31700,0]);
});

test("keep-rules resolves only a pending proposal",async () => {
  const h=createHttpHandlers(f.backend);
  await f.backend.run(f.agent,"weekly_basket");
  const s=await f.backend.run(f.agent,"pharmacy_refill");
  const r=await h.keepRules(request({proposalId:s.pendingException!.id},f.human.sessionId));
  expect((await r.json()).pendingException).toBeNull();
  expect((await h.regrant(request({proposalId:s.pendingException!.id},f.human.sessionId))).status).toBe(409);
});

test("HTTP rejects untrusted fields, invalid money, malformed JSON, missing sessions and cross-origin writes",async () => {
  const h=createHttpHandlers(f.backend);
  for(const body of [{budgetCents:-1},{budgetCents:1.2},{budgetCents:1000001},{creditAllowed:true},{expiryDays:0},{minimumAvailableBalanceCents:-1}]) {
    const r=await h.grant(request(body,f.human.sessionId));
    expect(r.status).toBe(400); expect(await r.json()).toMatchObject({error:"invalid_request"});
  }
  expect((await h.run(request({scenario:"weekly_basket",amountCents:1},f.human.sessionId))).status).toBe(400);
  expect((await h.run(request({scenario:"timeout"},f.human.sessionId))).status).toBe(400);
  expect((await h.run(new Request("http://localhost/api/test",{method:"POST",headers:{Cookie:`nac_session=${f.human.sessionId}`},body:"{"}))).status).toBe(400);
  expect((await h.grant(request({})) ).status).toBe(401);
  expect((await h.grant(request({},f.human.sessionId,{Origin:"https://evil.test"}))).status).toBe(403);
  const failed=await h.webhook(new Request("http://localhost/api/webhooks/provider",{method:"POST",headers:{"x-provider-signature":"fake"},body:"{}"}));
  expect(failed.status).toBe(401);
  expect(await failed.json()).toEqual({error:"invalid_signature",message:"The provider signature is invalid."});
});

test("attack route validates names and returns actual isolated evidence",async () => {
  const h=createHttpHandlers(f.backend);
  expect((await h.attack(request({name:"not-an-attack"}))).status).toBe(400);
  const r=await h.attack(request({name:"tampered_price"}));
  expect(await r.json()).toMatchObject({name:"tampered_price",stopped:true,providerCalls:0});
});
