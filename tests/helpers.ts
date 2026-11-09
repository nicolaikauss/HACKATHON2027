import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { createBackend } from "../src/server/backend";
import { SimulatedProvider } from "../src/server/payments";
import type { DatabaseExecutor, ApiFunction } from "../src/server/db";

export async function fixture() {
  const pg = new PGlite();
  await pg.exec(readFileSync(new URL("../supabase/migrations/0001_gate.sql", import.meta.url), "utf8"));
  const db: DatabaseExecutor = {
    async call<T>(name: ApiFunction, input: unknown): Promise<T> {
      const result = await pg.query<{ result: T }>(`select nexi.${name}($1::jsonb) as result`, [JSON.stringify(input)]);
      return result.rows[0].result;
    },
  };
  const provider = new SimulatedProvider("test-webhook-key");
  const backend = createBackend(db, provider);
  const initial = await backend.createSession();
  const human = { kind: "human" as const, sessionId: initial.sessionId };
  const agent = { kind: "agent" as const, sessionId: initial.sessionId };
  await backend.grant(human);
  return { pg, db, provider, backend, human, agent, close: () => pg.close() };
}
