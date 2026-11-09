import type { ApiError } from "../lib/contracts";

const messages: Record<string, string> = {
  human_required: "This operation requires a human principal.",
  agent_required: "This operation requires an agent principal.",
  session_not_found: "Start a demo session first.",
  invalid_request: "The request is invalid.",
  invalid_resolution: "This proposal cannot be resolved.",
  stale_proposal: "The mandate changed. Run the agent again.",
  one_time_pending: "Resolve the one-time payment first.",
  insufficient_balance: "The account cannot fund this payment.",
  idempotency_conflict: "This key was already used for a different request.",
  provider_event_conflict: "The provider event ID was already used with different data.",
  provider_mismatch: "The provider event does not match the bound payment.",
  invalid_provider_event: "The provider event is invalid.",
  invalid_payment_transition: "The payment cannot accept this event.",
  payment_not_found: "The payment was not found.",
  payments_pending: "Resolve pending payments before advancing the period.",
  no_eligible_offer: "There is no eligible offer for this scenario.",
  invalid_signature: "The provider signature is invalid.",
  origin_forbidden: "This request origin is not allowed.",
  configuration_error: "The server is not configured.",
};
export class GateError extends Error {
  constructor(readonly code: string, readonly status = 409) { super(messages[code] ?? "The operation could not be completed."); }
}
export function normalizeError(error: unknown): GateError {
  if (error instanceof GateError) return error;
  // Only exact, known database exceptions may cross the HTTP boundary.
  if (error instanceof Error && Object.hasOwn(messages, error.message)) return new GateError(error.message);
  return new GateError("internal_error", 500);
}
export function errorResponse(error: unknown): Response {
  const safe = normalizeError(error);
  return Response.json({ error: safe.code, message: safe.message } satisfies ApiError, { status: safe.status, headers: { "Cache-Control": "no-store" } });
}
