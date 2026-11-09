"use client";

import { useState } from "react";
import type { DemoState, ProposalView } from "@/lib/contracts";
import type { Actions } from "./Experience";
import { eur, eur0, HoldButton, Icon } from "./ui";

type Tab = "home" | "activity" | "authority";

const BASE = {
  budgetCents: 6500,
  minimumAvailableBalanceCents: 20000,
};

export function Phone({
  state,
  busy,
  actions,
  receiptId,
  setReceiptId,
}: {
  state: DemoState | null;
  busy: boolean;
  actions: Actions;
  receiptId: string | null;
  setReceiptId: (id: string | null) => void;
}) {
  const [tab, setTab] = useState<Tab>("home");
  const [regrantOpen, setRegrantOpen] = useState(false);

  const receipt = state?.proposals.find((p) => p.id === receiptId) ?? null;
  const exception = state?.pendingException ?? null;
  const showException = Boolean(exception) && !regrantOpen;
  const quote = state?.regrantQuote ?? null;
  const sheetOpen = showException || (regrantOpen && Boolean(quote)) || Boolean(receipt);

  return (
    <div className="device">
      <div className="screen">
        <div className="island" />
        {!state ? (
          <div className="scroll">
            <p className="label">Loading your agent</p>
          </div>
        ) : !state.mandate ? (
          <Grant state={state} actions={actions} />
        ) : (
          <>
            <div className="scroll">
              {tab === "home" && <Home state={state} onOpen={setReceiptId} />}
              {tab === "activity" && <Activity state={state} onOpen={setReceiptId} />}
              {tab === "authority" && <Authority state={state} busy={busy} actions={actions} />}
            </div>
            <nav className="nav" aria-label="Main">
              {(
                [
                  ["home", "home", "Home"],
                  ["activity", "receipt", "Activity"],
                  ["authority", "shield", "Authority"],
                ] as const
              ).map(([id, icon, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-label={label}
                  aria-current={tab === id ? "page" : undefined}
                  onClick={() => setTab(id)}
                >
                  <Icon name={icon} />
                </button>
              ))}
            </nav>
          </>
        )}

        <div
          className="scrim"
          data-open={sheetOpen}
          onClick={() => {
            if (receipt) setReceiptId(null);
          }}
        />

        <section className="sheet" data-open={showException} aria-hidden={!showException}>
          {exception && (
            <ExceptionView
              proposal={exception}
              busy={busy}
              onKeep={() => void actions.keepRules(exception.id)}
              onChange={() => setRegrantOpen(true)}
            />
          )}
        </section>

        <section
          className="sheet"
          data-open={regrantOpen && Boolean(quote)}
          aria-hidden={!(regrantOpen && quote)}
        >
          {quote && exception && (
            <div>
              <p className="label" style={{ margin: 0 }}>
                {exception.merchantName} · {eur(quote.amountCents)}
              </p>
              <p style={{ fontSize: 23, lineHeight: 1.3, margin: "8px 0 14px", fontWeight: 300 }}>
                You would be {eur0(quote.protectedShortfallCents)} under your protected line until
                your next pay, and {eur0(quote.budgetOverrunCents)} over this week&apos;s budget.
              </p>
              <div className="tile" style={{ fontSize: 14, lineHeight: 1.45 }}>
                This covers this purchase only. Your {eur0(BASE.minimumAvailableBalanceCents)} line
                and {eur0(BASE.budgetCents)} weekly budget return after it. The agent did not
                recommend this.
              </div>
              <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
                <button
                  type="button"
                  className="primary"
                  onClick={() => setRegrantOpen(false)}
                >
                  Go back
                </button>
                <HoldButton
                  label="Hold to allow once"
                  holdingLabel="Keep holding"
                  onComplete={() => {
                    setRegrantOpen(false);
                    void actions.regrant(exception.id);
                  }}
                />
              </div>
            </div>
          )}
        </section>

        <section className="sheet" data-open={Boolean(receipt)} aria-hidden={!receipt}>
          {receipt && state && (
            <Receipt proposal={receipt} state={state} onClose={() => setReceiptId(null)} />
          )}
        </section>
      </div>
    </div>
  );
}

function Grant({ state, actions }: { state: DemoState; actions: Actions }) {
  const [edit, setEdit] = useState<"budget" | "protected" | null>(null);
  const [budget, setBudget] = useState(BASE.budgetCents);
  const [protectedCents, setProtectedCents] = useState(BASE.minimumAvailableBalanceCents);
  const most = Math.max(0, Math.min(budget, state.availableBalanceCents - protectedCents));
  const step = (d: number) =>
    edit === "budget"
      ? setBudget((v) => Math.min(20000, Math.max(500, v + d)))
      : setProtectedCents((v) =>
          Math.min(state.availableBalanceCents, Math.max(0, v + d)),
        );

  return (
    <div className="scroll" style={{ paddingBottom: 24 }}>
      <p className="label" style={{ margin: 0 }}>
        Your agent&apos;s role
      </p>
      <p className="sentence">
        Buy my weekly essentials, up to{" "}
        <button type="button" className="token" onClick={() => setEdit("budget")}>
          {eur0(budget)} a week
        </button>
        , at these 3 shops. Never on credit. Never leave me under{" "}
        <button type="button" className="token" onClick={() => setEdit("protected")}>
          {eur0(protectedCents)}
        </button>
        . For the next 4 weeks.
      </p>
      {edit && (
        <div className="stepper">
          <button type="button" aria-label="Decrease by 5 euros" onClick={() => step(-500)}>
            −
          </button>
          <span>
            {edit === "budget" ? "Weekly budget" : "Protected money"}:{" "}
            {eur0(edit === "budget" ? budget : protectedCents)}
          </span>
          <button type="button" aria-label="Increase by 5 euros" onClick={() => step(500)}>
            +
          </button>
        </div>
      )}
      <div style={{ marginTop: "auto", display: "grid", gap: 12, paddingTop: 16 }}>
        <div className="tile">
          <p className="label" style={{ margin: 0 }}>
            The most it could spend this week
          </p>
          <p style={{ fontSize: 28, margin: "2px 0 0" }}>{eur(most)}</p>
          <p className="label" style={{ margin: "4px 0 0" }}>
            From a balance of {eur(state.availableBalanceCents)}. Granted by {state.ownerName}.
          </p>
        </div>
        <HoldButton
          label="Hold to grant"
          holdingLabel="Keep holding"
          onComplete={() =>
            void actions.grant({
              budgetCents: budget,
              perPaymentLimitCents: budget,
              minimumAvailableBalanceCents: protectedCents,
            })
          }
        />
      </div>
    </div>
  );
}

function statusLine(p: ProposalView, state: DemoState) {
  const payment = state.payments.find((x) => x.proposalId === p.id);
  if (p.decision === "request_approval") {
    if (p.humanResolution === "kept_rules") return "Stopped. You kept your rules";
    if (p.humanResolution === "regranted") return "Paused, then you allowed it once";
    return "Paused for your decision";
  }
  if (p.decision === "block") {
    const failed = p.policy.rules.filter((r) => !r.passed);
    return failed.length === 1 && failed[0].code === "mandate_active"
      ? "Blocked. Authority revoked"
      : "Blocked by your rules";
  }
  if (!payment) return "Allowed";
  const mandate = p.mandateVersion;
  if (payment.state === "executed") {
    return mandate === 1 ? "Executed, nothing asked of you" : `Executed under mandate v${mandate}`;
  }
  return `Payment state: ${payment.state.replace("_", " ")}`;
}

function Home({ state, onOpen }: { state: DemoState; onOpen: (id: string) => void }) {
  const m = state.mandate!;
  const total = Math.max(state.availableBalanceCents, 1);
  const protectedPart = Math.min(m.minimumAvailableBalanceCents, state.availableBalanceCents);
  const reach = state.reachCents;
  const rest = Math.max(0, state.availableBalanceCents - protectedPart - reach);
  const [whole, cents] = (state.reachCents / 100).toFixed(2).split(".");

  return (
    <>
      <div className="hero">
        <p className="label" style={{ margin: 0 }}>
          {m.status === "revoked" ? "Your agent has no authority" : "Your agent can still reach"}
        </p>
        <p className="hero-num" style={{ margin: 0 }}>
          €{whole}
          <span>.{cents}</span>
        </p>
        {state.protectedShortfallCents > 0 ? (
          <span className="chip warn">
            {eur0(state.protectedShortfallCents)} under your protected line
          </span>
        ) : (
          <span className="chip">
            {m.status === "active" ? `Essentials agent · active · v${m.version}` : "Authority revoked"}
          </span>
        )}
      </div>
      <div className="glass">
        <div className="row">
          <span style={{ fontSize: 14, color: "#d6e2ff" }}>Protected</span>
          <span>{eur0(m.minimumAvailableBalanceCents)}</span>
        </div>
        <div className="bar" aria-hidden="true">
          <div style={{ flex: protectedPart / total, background: "#dce6ff" }} />
          {reach > 0 && <div style={{ flex: reach / total, background: "#5b86f0" }} />}
          {rest > 0 && <div style={{ flex: rest / total, background: "#3a5cb5" }} />}
        </div>
        <div className="row">
          <span style={{ fontSize: 14, color: "#d6e2ff" }}>Balance</span>
          <span>{eur(state.availableBalanceCents)}</span>
        </div>
      </div>
      {state.oneTimeExceptionCount > 0 && (
        <p className="label" style={{ margin: "12px 0 0", textAlign: "center" }}>
          {state.oneTimeExceptionCount} one-time exception
          {state.oneTimeExceptionCount === 1 ? "" : "s"} this month
        </p>
      )}
      <p style={{ fontSize: 17, fontWeight: 500, margin: "18px 0 0" }}>Recent activity</p>
      <Rows state={state} onOpen={onOpen} limit={3} />
    </>
  );
}

function Rows({
  state,
  onOpen,
  limit,
}: {
  state: DemoState;
  onOpen: (id: string) => void;
  limit?: number;
}) {
  const rows = limit ? state.proposals.slice(0, limit) : state.proposals;
  if (rows.length === 0) {
    return (
      <p className="label" style={{ marginTop: 8 }}>
        Your agent has not bought anything yet. Payments inside your rules will appear here without
        asking you.
      </p>
    );
  }
  return (
    <div className="list">
      {rows.map((p) => (
        <button key={p.id} type="button" className="item" onClick={() => onOpen(p.id)}>
          <div className="row">
            <span style={{ fontSize: 15 }}>{p.merchantName}</span>
            <span style={{ fontSize: 15 }}>−{eur0(p.amountCents)}</span>
          </div>
          <p className="label" style={{ margin: "2px 0 0" }}>
            {statusLine(p, state)}
          </p>
        </button>
      ))}
    </div>
  );
}

function Activity({ state, onOpen }: { state: DemoState; onOpen: (id: string) => void }) {
  return (
    <>
      <p style={{ fontSize: 24, fontWeight: 400, margin: "8px 0 4px" }}>Activity</p>
      <Rows state={state} onOpen={onOpen} />
    </>
  );
}

function Authority({
  state,
  busy,
  actions,
}: {
  state: DemoState;
  busy: boolean;
  actions: Actions;
}) {
  const m = state.mandate!;
  const revoked = m.status === "revoked";
  return (
    <>
      <p style={{ fontSize: 24, fontWeight: 400, margin: "8px 0 8px" }}>Authority</p>
      <p style={{ fontSize: 19, lineHeight: 1.45, fontWeight: 300, margin: 0 }}>
        Buy my weekly essentials, up to {eur0(m.budgetCents)} a week, at these{" "}
        {m.allowedMerchantIds.length} shops. Never on credit. Never leave me under{" "}
        {eur0(m.minimumAvailableBalanceCents)}.
      </p>
      <div className="tile" style={{ marginTop: 16, fontSize: 14 }}>
        <div className="row" style={{ padding: "3px 0" }}>
          <span className="label">Granted by</span>
          <span>{m.grantedBy}</span>
        </div>
        <div className="row" style={{ padding: "3px 0" }}>
          <span className="label">Status</span>
          <span>{revoked ? "Revoked" : `Active, v${m.version}`}</span>
        </div>
        <div className="row" style={{ padding: "3px 0" }}>
          <span className="label">Expires</span>
          <span>{new Date(m.expiresAt).toLocaleDateString("en-GB")}</span>
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <button
          type="button"
          className="secondary"
          disabled={busy || revoked}
          onClick={() => void actions.revoke()}
        >
          {revoked ? "Authority revoked" : "Revoke authority"}
        </button>
        <p className="label" style={{ margin: "8px 4px 0" }}>
          Revoking stops future payments. Completed payments stay as they are.
        </p>
      </div>
    </>
  );
}

function ExceptionView({
  proposal,
  busy,
  onKeep,
  onChange,
}: {
  proposal: ProposalView;
  busy: boolean;
  onKeep: () => void;
  onChange: () => void;
}) {
  const failed = proposal.policy.rules.filter((r) => !r.passed);
  const passed = proposal.policy.rules.length - failed.length;
  const headline = [...failed].sort((a) => (a.code === "balance_above_buffer" ? -1 : 1));
  return (
    <div>
      <span className="badge">Simulated incoming request</span>
      <p className="label" style={{ margin: "12px 0 2px" }}>
        {proposal.merchantName} · {proposal.label} · {eur(proposal.amountCents)}
      </p>
      <p style={{ fontSize: 24, fontWeight: 300, lineHeight: 1.25, margin: 0 }}>
        I paused this. No payment was submitted.
      </p>
      <div className="tile" style={{ marginTop: 12, padding: "4px 14px" }}>
        {headline.map((r) => (
          <div className="rule" key={r.code}>
            <span className="stop">
              <Icon name="x" size={18} />
            </span>
            <span>{r.explanation}</span>
          </div>
        ))}
        <div className="rule">
          <span className="pass">
            <Icon name="check" size={18} />
          </span>
          <span>{passed} other checks passed</span>
        </div>
      </div>
      <p className="label" style={{ margin: "14px 0 8px" }}>
        This one is your call.
      </p>
      <div style={{ display: "grid", gap: 8 }}>
        <button type="button" className="primary" disabled={busy} onClick={onKeep}>
          Keep my rules
        </button>
        <button type="button" className="secondary" disabled={busy} onClick={onChange}>
          Change my authority
        </button>
      </div>
    </div>
  );
}

function Receipt({
  proposal,
  state,
  onClose,
}: {
  proposal: ProposalView;
  state: DemoState;
  onClose: () => void;
}) {
  const payment = state.payments.find((p) => p.proposalId === proposal.id);
  const passed = proposal.policy.rules.filter((r) => r.passed).length;
  const offers = proposal.scenario === "weekly_basket" ? state.offers : [];
  return (
    <div>
      <div className="row">
        <span className="label">Receipt</span>
        <button type="button" className="ghost" onClick={onClose}>
          Close
        </button>
      </div>
      <p style={{ fontSize: 30, margin: "6px 0 0" }}>{eur(proposal.amountCents)}</p>
      <p style={{ margin: "0 0 10px", fontSize: 16 }}>
        {proposal.merchantName} · {proposal.label}
      </p>
      {offers.length > 0 && (
        <div className="tile" style={{ marginBottom: 10 }}>
          <p className="label" style={{ margin: "0 0 4px" }}>
            Your agent compared synthetic offers
          </p>
          {offers.map((o) => (
            <div key={o.id} style={{ padding: "4px 0", fontSize: 14 }}>
              <div className="row">
                <span className={o.eligible ? undefined : "stop"}>
                  {o.selected ? "Chosen: " : ""}
                  {o.merchantName}
                </span>
                <span>{eur0(o.amountCents)}</span>
              </div>
              <p className="label" style={{ margin: 0, fontSize: 12 }}>
                {o.eligibilityReason}
              </p>
            </div>
          ))}
        </div>
      )}
      <div className="tile" style={{ fontSize: 14 }}>
        <div className="row" style={{ padding: "3px 0" }}>
          <span className="label">Payment</span>
          <span>{payment ? payment.state : "Not submitted"}</span>
        </div>
        <div className="row" style={{ padding: "3px 0" }}>
          <span className="label">Rules passed</span>
          <span>
            {passed} of {proposal.policy.rules.length}
          </span>
        </div>
        <div className="row" style={{ padding: "3px 0" }}>
          <span className="label">Authority</span>
          <span>
            {state.ownerName}, mandate v{proposal.mandateVersion}
          </span>
        </div>
        {payment?.providerReference && (
          <div className="row" style={{ padding: "3px 0" }}>
            <span className="label">Simulated ref</span>
            <span className="mono">{payment.providerReference}</span>
          </div>
        )}
      </div>
    </div>
  );
}
