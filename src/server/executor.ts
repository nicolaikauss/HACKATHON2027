import type { DatabaseExecutor } from "./db";
import type { PaymentAdapter } from "./payments";
import { verifiedProviderHandler } from "./payments";
import type { BeginResult, PaymentRequest } from "./types";

export async function executePayment(db: DatabaseExecutor, provider: PaymentAdapter, sessionId: string, paymentId: string, scenario?: "timeout"): Promise<void> {
  const begin = await db.call<BeginResult>("api_begin_submission",{sessionId,paymentId});
  if (!begin.started) return;
  const payment: PaymentRequest = { reference:begin.payment.providerReference!, amountCents:begin.payment.amountCents, currency:"EUR", bindingHash:begin.payment.bindingHash };
  const deliver = (raw: string, signature: string) => verifiedProviderHandler(db,provider,raw,signature);
  try { await provider.submit(payment,deliver,scenario); }
  catch {
    // Never retry a call whose outcome is ambiguous. Keep its reservation.
    await provider.reportUnknown(payment,deliver);
  }
}
