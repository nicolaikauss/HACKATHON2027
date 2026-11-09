import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

test("migration creates the gate with private tables and API-only application privileges", async () => {
  const db = new PGlite();
  try {
    const path = new URL("../supabase/migrations/0001_gate.sql", import.meta.url);
    expect(() => readFileSync(path, "utf8")).not.toThrow();
    await db.exec("create role anon; create role authenticated");
    await db.exec(readFileSync(path, "utf8"));
    const tables = await db.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='nexi' and c.relkind='r'",
    );
    expect(tables.rows.length).toBeGreaterThanOrEqual(9);
    expect(tables.rows.every((t) => t.relrowsecurity)).toBe(true);
    const role = await db.query<{ rolcanlogin: boolean }>("select rolcanlogin from pg_roles where rolname='nexi_app'");
    expect(role.rows[0].rolcanlogin).toBe(false);
    const functions = await db.query<{prosecdef:boolean;proconfig:string[];app_execute:boolean;proname:string}>(
      "select prosecdef,proconfig,proname,has_function_privilege('nexi_app',p.oid,'execute') as app_execute from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='nexi'",
    );
    for(const fn of functions.rows) {
      expect(fn.prosecdef).toBe(true);
      expect(fn.proconfig).toContain("search_path=nexi, pg_temp");
      expect(fn.app_execute).toBe(fn.proname.startsWith("api_"));
    }
    expect((await db.query("select * from pg_policies where schemaname='nexi'")).rows).toHaveLength(0);
    for(const name of ["anon","authenticated"]) {
      expect((await db.query<{allowed:boolean}>("select has_schema_privilege($1,'nexi','usage') as allowed",[name])).rows[0].allowed).toBe(false);
    }
    await db.exec("set role nexi_app");
    await expect(db.query("select * from nexi.accounts")).rejects.toThrow(/permission denied/);
    await expect(db.query("select nexi.api_create_session('{}'::jsonb)")).resolves.toBeDefined();
    await expect(db.query("select nexi.submit_proposal('{}'::jsonb)")).rejects.toThrow(/permission denied/);
    await db.exec("reset role");
  } finally { await db.close(); }
});
