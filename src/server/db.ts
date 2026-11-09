import "server-only";
import { GateError, normalizeError } from "./errors";

export const apiFunctions = ["api_create_session", "api_state", "api_agent_context", "api_human_grant", "api_human_keep_rules", "api_human_regrant", "api_human_revoke", "api_submit_proposal", "api_begin_submission", "api_apply_provider_event", "api_next_week"] as const;
export type ApiFunction = typeof apiFunctions[number];
export interface DatabaseExecutor { call<T>(name: ApiFunction, input: unknown): Promise<T> }

let production: DatabaseExecutor | undefined;
export function productionDatabase(): DatabaseExecutor {
  if (production) return production;
  const url = process.env.SUPABASE_URL;
  const apiKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.NEXI_GATEWAY_SECRET;
  if (!url || !apiKey || !secret) throw new GateError("configuration_error", 503);
  production = {
    async call<T>(name: ApiFunction, input: unknown): Promise<T> {
      if (!apiFunctions.includes(name)) throw new GateError("invalid_request", 400);
      try {
        // Each call is one Postgres transaction. The gateway secret never reaches the browser.
        const response = await fetch(`${url}/rest/v1/rpc/nexi_gateway`, {
          method: "POST",
          headers: { apikey: apiKey, "content-type": "application/json" },
          body: JSON.stringify({ secret, fn: name, input }),
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(typeof data?.message === "string" ? data.message : "gateway_failed");
        return data as T;
      } catch (error) { throw normalizeError(error); }
    },
  };
  return production;
}
