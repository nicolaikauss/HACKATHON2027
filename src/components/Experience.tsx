"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AgentScenario,
  ApiError,
  AttackName,
  AttackResult,
  DemoState,
} from "@/lib/contracts";
import { previewCall, uiPreview } from "@/lib/previewBackend";
import { Phone } from "./Phone";
import { Rail } from "./Rail";

const modeLabel = {
  simulation: "Simulated payments",
  "nexi-sandbox": "Nexi sandbox",
  "stripe-sandbox": "Stripe sandbox",
} as const;

async function call<T>(url: string, body?: unknown): Promise<T> {
  if (uiPreview) return previewCall(url, (body ?? {}) as Record<string, unknown>) as T;
  const res = await fetch(url, {
    method: body === undefined && url === "/api/state" ? "GET" : "POST",
    headers: { "content-type": "application/json" },
    body: url === "/api/state" ? undefined : JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data as ApiError | null)?.message ?? "The request failed. Try again.");
  }
  return data as T;
}

export type GrantInput = {
  budgetCents: number;
  perPaymentLimitCents: number;
  minimumAvailableBalanceCents: number;
};

export function Experience() {
  const [state, setState] = useState<DemoState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [attacks, setAttacks] = useState<Partial<Record<AttackName, AttackResult>>>({});

  const run = useCallback(async (fn: () => Promise<DemoState>): Promise<DemoState | null> => {
    setBusy(true);
    setError(null);
    try {
      const next = await fn();
      setState(next);
      return next;
    } catch (e) {
      setError(e instanceof Error ? e.message : "The request failed. Try again.");
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void run(() => call<DemoState>("/api/state"));
  }, [run]);

  const agent = useCallback(
    async (scenario: AgentScenario) => {
      const next = await run(() => call<DemoState>("/api/agent/run", { scenario }));
      const latest = next?.proposals.find((p) => p.scenario === scenario);
      if (latest && latest.decision === "allow") setReceiptId(latest.id);
    },
    [run],
  );

  const actions = {
    grant: (input: GrantInput) => run(() => call<DemoState>("/api/human/grant", input)),
    agent,
    keepRules: (proposalId: string) =>
      run(() => call<DemoState>("/api/human/keep-rules", { proposalId })),
    regrant: async (proposalId: string) => {
      const next = await run(() => call<DemoState>("/api/human/regrant", { proposalId }));
      if (next) await agent("pharmacy_refill");
    },
    revoke: () => run(() => call<DemoState>("/api/human/revoke")),
    nextWeek: () => run(() => call<DemoState>("/api/demo/next-week")),
    reset: async () => {
      setReceiptId(null);
      setAttacks({});
      await run(() => call<DemoState>("/api/demo/reset"));
    },
    attack: async (name: AttackName) => {
      setBusy(true);
      setError(null);
      try {
        const result = await call<AttackResult>("/api/demo/attack", { name });
        setAttacks((a) => ({ ...a, [name]: result }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "The attack could not run.");
      } finally {
        setBusy(false);
      }
    },
  };

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          Agent Control
          <small>Student concept for Nexi. Not a Nexi product.</small>
        </div>
        <div style={{ flex: 1 }} />
        {uiPreview && <span className="badge">UI preview: gate not connected</span>}
        <span className="badge solid">{state ? modeLabel[state.mode] : "Simulated payments"}</span>
        <span className="badge">Synthetic offers</span>
        <span className="badge">Scripted planner</span>
        <button type="button" className="ghost" onClick={() => void actions.reset()}>
          Reset
        </button>
      </header>
      {error && (
        <div className="toast" role="alert">
          {error}
        </div>
      )}
      <div className="stage">
        <Phone
          state={state}
          busy={busy}
          actions={actions}
          receiptId={receiptId}
          setReceiptId={setReceiptId}
        />
        <Rail state={state} busy={busy} actions={actions} attacks={attacks} />
      </div>
    </main>
  );
}

export type Actions = {
  grant: (input: GrantInput) => Promise<DemoState | null>;
  agent: (scenario: AgentScenario) => Promise<void>;
  keepRules: (proposalId: string) => Promise<DemoState | null>;
  regrant: (proposalId: string) => Promise<void>;
  revoke: () => Promise<DemoState | null>;
  nextWeek: () => Promise<DemoState | null>;
  reset: () => Promise<void>;
  attack: (name: AttackName) => Promise<void>;
};
