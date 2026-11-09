import { z } from "zod";
import type { Backend } from "./backend";
import { errorResponse, GateError } from "./errors";
import { readSession, requireSession, sessionCookie } from "./session";

const money=z.number().int().min(1).max(1000000);
const grantSchema=z.object({budgetCents:money.optional(),perPaymentLimitCents:money.optional(),minimumAvailableBalanceCents:z.number().int().min(0).max(1000000).optional(),expiryDays:z.number().int().min(1).max(365).optional()}).strict();
const proposalSchema=z.object({proposalId:z.uuid()}).strict();
const runSchema=z.object({scenario:z.enum(["weekly_basket","pharmacy_refill","next_basket"])}).strict();
const attackSchema=z.object({name:z.enum(["tampered_price","swapped_merchant","replay","double_spend","agent_self_regrant","pay_after_revoke","forged_callback"])}).strict();
const emptySchema=z.object({}).strict();

async function body<T>(request: Request, schema: z.ZodType<T>, optional=false): Promise<T> {
  const raw=await request.text();
  if(raw.length>8192) throw new GateError("invalid_request",413);
  let input: unknown;
  try { input=optional && !raw.trim()?{}:JSON.parse(raw); }
  catch { throw new GateError("invalid_request",400); }
  const parsed=schema.safeParse(input);
  if(!parsed.success) throw new GateError("invalid_request",400);
  return parsed.data;
}
function checkOrigin(request: Request): void {
  const origin=request.headers.get("origin");
  if(origin && origin!==new URL(request.url).origin) throw new GateError("origin_forbidden",403);
}
function json(data: unknown, headers?: HeadersInit): Response {
  return Response.json(data,{headers:{"Cache-Control":"no-store",...headers}});
}
type Handler = (request: Request) => Promise<Response>;
const safe = (handler: Handler): Handler => async request => {
  try { return await handler(request); } catch(error) { return errorResponse(error); }
};

export function createHttpHandlers(backend: Backend) {
  async function human(request: Request) { return {kind:"human" as const,sessionId:await requireSession(backend,request)}; }
  return {
    state: safe(async request => {
      const id=readSession(request);
      if(id) {
        try { return json(await backend.state(id)); }
        catch(error) { if(!(error instanceof GateError) || error.code!=="session_not_found") throw error; }
      }
      const state=await backend.createSession();
      return json(state,{"Set-Cookie":sessionCookie(request,state.sessionId)});
    }),
    grant: safe(async request => {
      checkOrigin(request);
      const principal=await human(request);
      return json(await backend.grant(principal,await body(request,grantSchema,true)));
    }),
    keepRules: safe(async request => {
      checkOrigin(request);
      const principal=await human(request);
      return json(await backend.keepRules(principal,(await body(request,proposalSchema)).proposalId));
    }),
    regrant: safe(async request => {
      checkOrigin(request);
      const principal=await human(request);
      return json(await backend.regrant(principal,(await body(request,proposalSchema)).proposalId));
    }),
    revoke: safe(async request => {
      checkOrigin(request);
      const principal=await human(request);
      await body(request,emptySchema,true);
      return json(await backend.revoke(principal));
    }),
    run: safe(async request => {
      checkOrigin(request);
      const sessionId=await requireSession(backend,request);
      const {scenario}=await body(request,runSchema);
      return json(await backend.run({kind:"agent",sessionId},scenario));
    }),
    nextWeek: safe(async request => {
      checkOrigin(request);
      const sessionId=await requireSession(backend,request);
      await body(request,emptySchema,true);
      return json(await backend.nextWeek(sessionId));
    }),
    reset: safe(async request => {
      checkOrigin(request);
      await body(request,emptySchema,true);
      const state=await backend.createSession();
      return json(state,{"Set-Cookie":sessionCookie(request,state.sessionId)});
    }),
    attack: safe(async request => {
      checkOrigin(request);
      return json(await backend.attack((await body(request,attackSchema)).name));
    }),
    webhook: safe(async request => {
      const raw=await request.text();
      if(raw.length>8192) throw new GateError("invalid_request",413);
      return backend.webhook(raw,request.headers.get("x-provider-signature"));
    }),
  };
}
