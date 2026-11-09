import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { DatabaseExecutor } from "../db";
import { errorResponse, GateError } from "../errors";
import type { PaymentRequest, ProviderEvent } from "../types";

export interface PaymentAdapter {
  readonly providerCalls: number;
  submit(payment: PaymentRequest, deliver: VerifiedDelivery, scenario?: "timeout"): Promise<void>;
  verify(raw: string, signature: string | null): boolean;
  // An ambiguous transport failure is also delivered through the verified event path.
  reportUnknown(payment: PaymentRequest, deliver: VerifiedDelivery): Promise<void>;
  isolated(): PaymentAdapter;
}
export type VerifiedDelivery = (raw: string, signature: string) => Promise<Response>;
const eventSchema = z.object({
  eventId: z.string().min(1).max(200), reference: z.string().min(1).max(200),
  amountCents: z.number().int().positive().max(2147483647), currency: z.literal("EUR"),
  bindingHash: z.string().regex(/^[a-f0-9]{64}$/),
  state: z.enum(["authorized", "executed", "failed", "requires_action", "unknown"]),
}).strict();

export async function verifiedProviderHandler(db: DatabaseExecutor, adapter: PaymentAdapter, raw: string, signature: string | null): Promise<Response> {
  if (!adapter.verify(raw,signature)) return errorResponse(new GateError("invalid_signature",401));
  try {
    let body: unknown;
    try { body = JSON.parse(raw); } catch { throw new GateError("invalid_provider_event",400); }
    const parsed = eventSchema.safeParse(body);
    if (!parsed.success) throw new GateError("invalid_provider_event",400);
    await db.call("api_apply_provider_event",parsed.data);
    return Response.json({ok:true}, {headers:{"Cache-Control":"no-store"}});
  } catch(error) { return errorResponse(error); }
}

export class SimulatedProvider implements PaymentAdapter {
  private calls = 0;
  constructor(private readonly secret: string) {
    if (!secret) throw new GateError("configuration_error",503);
  }
  get providerCalls(): number { return this.calls; }
  sign(raw: string): string { return createHmac("sha256",this.secret).update(raw).digest("hex"); }
  verify(raw: string, signature: string | null): boolean {
    if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
    return timingSafeEqual(Buffer.from(this.sign(raw),"hex"), Buffer.from(signature,"hex"));
  }
  private async emit(payment: PaymentRequest, state: ProviderEvent["state"], deliver: VerifiedDelivery): Promise<void> {
    const raw = JSON.stringify({...payment,eventId:randomUUID(),state} satisfies ProviderEvent);
    const result = await deliver(raw,this.sign(raw));
    if (!result.ok) throw new GateError("provider_delivery_failed",502);
  }
  async submit(payment: PaymentRequest, deliver: VerifiedDelivery, scenario?: "timeout"): Promise<void> {
    this.calls += 1; // Counts actual provider invocations, never gate decisions or callback events.
    if (scenario === "timeout") { await this.reportUnknown(payment,deliver); return; }
    await this.emit(payment,"authorized",deliver);
    await this.emit(payment,"executed",deliver);
  }
  async reportUnknown(payment: PaymentRequest, deliver: VerifiedDelivery): Promise<void> {
    await this.emit(payment,"unknown",deliver);
  }
  isolated(): SimulatedProvider { return new SimulatedProvider(this.secret); }
}

export function productionProvider(): SimulatedProvider {
  // The only environment read of the provider credential lives in this directory.
  return new SimulatedProvider(process.env.PROVIDER_WEBHOOK_SECRET ?? "");
}
