"use client";

import type { AttackName, AttackResult, DemoState } from "@/lib/contracts";
import type { Actions } from "./Experience";
import { eur, Icon } from "./ui";

const ATTACKS: { name: AttackName; label: string }[] = [
  { name: "tampered_price", label: "Agent lies about the price" },
  { name: "swapped_merchant", label: "Agent swaps the merchant" },
  { name: "replay", label: "Agent retries the same payment" },
  { name: "double_spend", label: "Two payments at the same moment" },
  { name: "agent_self_regrant", label: "Agent expands its own authority" },
  { name: "pay_after_revoke", label: "Revoked just before submission" },
  { name: "forged_callback", label: "Forged provider message" },
];

export function Rail({
  state,
  busy,
  actions,
  attacks,
}: {
  state: DemoState | null;
  busy: boolean;
  actions: Actions;
  attacks: Partial<Record<AttackName, AttackResult>>;
}) {
  const latest = state?.proposals[0] ?? null;
  const m = state?.mandate ?? null;

  const steps: { label: string; run: () => void }[] = [
    { label: "Agent buys the weekly basket", run: () => void actions.agent("weekly_basket") },
    { label: "Incoming: pharmacy refill", run: () => void actions.agent("pharmacy_refill") },
    { label: "One week later: pay arrives, +€120", run: () => void actions.nextWeek() },
    { label: "Agent tries the next basket", run: () => void actions.agent("next_basket") },
  ];

  return (
    <aside className="rail" aria-label="Server evidence">
      <section className="panel">
        <h2>The rail</h2>
        <p className="hint">Values from the server. The agent cannot write to any of them.</p>
        <div className="stat-row">
          <Stat label="Reach" value={state ? eur(state.reachCents) : "-"} />
          <Stat label="Available" value={state ? eur(state.availableBalanceCents) : "-"} />
          <Stat
            label="Budget left"
            value={m ? eur(Math.max(0, m.budgetCents - m.spentCents - m.reservedCents)) : "-"}
          />
          <Stat label="Reserved" value={m ? eur(m.reservedCents) : "-"} />
        </div>
      </section>

      <div className="rail-grid">
        <section className="panel">
          <h2>Simulator</h2>
          <p className="hint">Labelled events that drive the demo. Not a live background service.</p>
          {steps.map((s, i) => (
            <button key={s.label} type="button" className="action" disabled={busy} onClick={s.run}>
              <span>
                {i + 1}. {s.label}
              </span>
            </button>
          ))}
        </section>

        <section className="panel">
          <h2>Attack the gate</h2>
          <p className="hint">Each attack runs against the real gate in a separate session.</p>
          {ATTACKS.map((a) => {
            const r = attacks[a.name];
            return (
              <button
                key={a.name}
                type="button"
                className="action"
                disabled={busy}
                title={r?.summary}
                onClick={() => void actions.attack(a.name)}
              >
                <span>{a.label}</span>
                {r && (
                  <span className={r.stopped ? "pass" : "stop"} style={{ whiteSpace: "nowrap" }}>
                    {r.stopped ? "Stopped" : "Not stopped"}
                  </span>
                )}
              </button>
            );
          })}
        </section>
      </div>

      <div className="rail-grid">
        <section className="panel">
          <h2>Latest gate decision</h2>
          {latest ? (
            <>
              <p className="hint">
                {latest.merchantName}, {eur(latest.amountCents)}:{" "}
                <span
                  className={
                    latest.decision === "allow"
                      ? "pass"
                      : latest.decision === "block"
                        ? "stop"
                        : "waiting"
                  }
                >
                  {latest.decision.replace("_", " ")}
                </span>
              </p>
              <div className="audit">
                {[...latest.policy.rules]
                  .sort((a, b) => Number(a.passed) - Number(b.passed))
                  .map((r) => (
                    <div className="rule" key={r.code}>
                      <span className={r.passed ? "pass" : "stop"}>
                        <Icon name={r.passed ? "check" : "x"} size={16} />
                      </span>
                      <span>{r.explanation}</span>
                    </div>
                  ))}
              </div>
            </>
          ) : (
            <p className="hint">No proposal yet. Grant authority, then run the agent.</p>
          )}
        </section>

        <section className="panel">
          <h2>Audit log</h2>
          <p className="hint">Append-only in this app. Not cryptographic proof.</p>
          <div className="audit">
            {state?.audit.map((e) => (
              <div className="rule" key={e.id}>
                <span className="mono" style={{ color: "var(--text-2)", minWidth: 62 }}>
                  {e.actor}
                </span>
                <span>{e.summary}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <p className="label">{label}</p>
      <p className="v">{value}</p>
    </div>
  );
}
