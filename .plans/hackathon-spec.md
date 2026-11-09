# Nexi Agent Control: hackathon specification

Working name only. This is a student concept, not a Nexi product or partnership.

## 1. What the system does

A person grants an AI agent limited authority to buy weekly essentials. The agent can only propose a purchase. A separate server layer, called the gate, decides whether the purchase is allowed. The agent cannot change this decision, because the gate reads its data from the database and does not trust the agent or the browser.

The main principle is enforcement: if the agent is confused or manipulated, the gate still prevents it from exceeding the person's authority.

## 2. Status of each part

| Part | Status in this prototype |
|---|---|
| Rules, reservations, idempotency, revocation, audit log | Real. They run in Postgres. |
| Agent planner | Deterministic script. The interface must label it. |
| Payment provider | Simulated. The interface must show "Simulated payments". |
| Provider callback verification | Real HMAC check of a simulated provider's message. HMAC means a keyed hash that proves who wrote a message. |
| Merchants, offers, Elena, pay event, incoming pharmacy request | Synthetic. The interface must label them. |

Do not claim AP2 compliance, legal compliance, production security, or general fraud prevention. The audit log is append-only at application level. It is not cryptographic proof.

## 3. Demo sequence and required numbers

All amounts are integer EUR cents.

Reach is the most the agent can still spend: `max(0, min(budget remaining, per-payment limit, available − reserved − protected))`. Reach is 0 when the mandate is not active.

| Step | Trigger | Balance | Budget left | Reach | Required outcome |
|---|---|---|---|---|---|
| 1 | Elena grants v1 | 28000 | 6500 | 6500 | Mandate is active. |
| 2 | Agent runs `weekly_basket` | 22200 | 700 | 700 | Offer A (5800) executes. |
| 3 | Agent runs `pharmacy_refill` | 22200 | 700 | 700 | Decision `request_approval`. Only `budget_remaining` and `balance_above_buffer` fail. No provider call. |
| 4 | Elena re-grants once, agent runs `pharmacy_refill` again | 19700 | 0 | 0 | v2 allows it. Payment executes. v3 restores v1 terms. `protectedShortfallCents` is 300. |
| 5 | Simulator: next week, pay +12000 | 31700 | 6500 | 6500 | Period advances. Spent resets to 0. |
| 6 | Elena revokes, agent runs `next_basket` (5200) | 31700 | n/a | 0 | Decision `block`. `mandate_active` is the only failed rule. No provider call. |

Mandate v1 terms: purpose "Weekly household essentials", category `essentials`, budget 6500, per-payment limit 6500, protected 20000, credit false, expiry 28 days after grant, merchants `dispensa-nord`, `mercato-aurora`, `farmacia-lumen`.

Offers (immutable, keyed by id and version):

| Offer | Merchant | Amount | Approved merchant | Scenario |
|---|---|---|---|---|
| `offer-a` v1 | `dispensa-nord` Dispensa Nord | 5800 | Yes | `weekly_basket`, selected |
| `offer-b` v1 | `mercato-aurora` Mercato Aurora | 6100 | Yes | `weekly_basket` |
| `offer-c` v1 | `spesa-lampo` Spesa Lampo | 5400 | No | `weekly_basket`, not eligible |
| `offer-pharmacy` v1 | `farmacia-lumen` Farmacia Lumen | 2500 | Yes | `pharmacy_refill` |
| `offer-next` v1 | `dispensa-nord` Dispensa Nord | 5200 | Yes | `next_basket` |

The planner selects the cheapest offer whose merchant and category the current mandate allows. Funding type is `debit`.

## 4. The six guardrails

### G1. Server-side mandate enforcement
Postgres function `nexi.submit_proposal` evaluates every rule in `RuleCode`. It does not stop at the first failure, because the interface must show every reason. It reads the mandate, account, and offer from the database under a row lock.

Decision logic:
1. If any rule fails and every failed rule is `budget_remaining` or `balance_above_buffer`, the decision is `request_approval`.
2. If any other rule fails, the decision is `block`.
3. If no rule fails, the decision is `allow`.

Neither `request_approval` nor `block` calls the provider. Rule explanations come from the rule results and contain actual numbers. A model never writes them.

### G2. Payment bound to the exact offer
The agent sends an offer id, offer version, and its claimed merchant, amount, and currency. The gate loads the offer and fails `offer_matches_server` if a claim differs. On `allow`, the gate stores a binding hash: SHA-256 of `proposal|merchant|amount|currency|offer|offerVersion|mandateVersion`, using Postgres built-in `sha256`. The executor passes this binding to the provider. A provider event must match the payment's reference and amount.

### G3. Duplicate and concurrent-payment protection
`proposals` has a unique constraint on `(session_id, idempotency_key)`. A repeated key with the same request returns the first result with `replayed: true` and starts no new payment. A repeated key with a different request is rejected with `idempotency_conflict`.

`submit_proposal` locks the mandate and account rows with `FOR UPDATE` before evaluation. Budget and balance checks include `reserved_cents`. An allowed proposal reserves the amount in the same transaction.

The planner key is `scenario:v{mandateVersion}:p{period}:{mandateStatus}`.

### G4. Revocation and expiry
`nexi.begin_submission` locks the mandate immediately before the provider call. It rechecks active status, expiry, and current version. If a check fails, it sets the payment to `blocked`, releases the reservation, and writes an audit event. A provider call never starts in that case.

Limitation to state in the README: revocation cannot recall a payment after `begin_submission` has succeeded. Revocation does not change completed payments.

### G5. Tool and credential isolation
Server code has an explicit principal: `{ kind: "human" | "agent", sessionId }`.

- The agent can read eligible offers and call `submitProposal`. The agent has no function that takes a provider secret, changes a mandate, or sets a payment state.
- Re-grant, grant, keep-rules, and revoke functions in `src/server` must reject a principal whose kind is not `human`, with error `human_required`.
- The provider secret is read only in `src/server/payments`.
- The database role `nexi_app` has `EXECUTE` on `nexi.api_*` functions only. It has no table privileges. Row level security is on for every table, with no policies. `anon`, `authenticated`, and `public` have no access to the schema.

### G6. Verified outcome and evidence
Only `nexi.apply_provider_event` changes a payment to `authorized`, `executed`, `failed`, `requires_action`, or `unknown`. It runs only after TypeScript verifies the HMAC-SHA256 signature of the raw body with a timing-safe comparison. Provider event ids are unique, so a repeated event has no second effect.

Ledger rules:
- `allow`: add to `reserved_cents`.
- `authorized`, `requires_action`, `unknown`: keep the reservation. Spending does not settle.
- `executed`: remove from `reserved_cents`, subtract from available, add to `spent_cents`.
- `failed`: release the reservation.
- A timeout becomes `unknown` and the executor never retries it automatically.

Tables `audit_events` and `ledger_entries` have triggers that reject `UPDATE` and `DELETE`. Each decision stores a mandate snapshot, the offer, rule results, provider reference, and timestamps.

## 5. Re-grant

Function `nexi.human_regrant(session, proposal_id)`:
1. Accepts only a proposal whose decision is `request_approval` and whose resolution is `none`.
2. Computes new terms on the server. New protected amount equals projected available balance. New budget equals spent plus reserved plus the proposal amount. The caller cannot supply these values.
3. Creates version `kind = one_time`, scoped to that offer id and offer version.
4. Sets `consumed_at` when the gate reserves funds against it. Rule `one_time_scope` fails for a different offer or a consumed version.
5. On the terminal provider state (`executed` or `failed`), creates a new `standing` version with the terms of the last standing version.

The old proposal stays on record with resolution `regranted`. The agent must submit a new proposal.

`DemoState.regrantQuote` gives `protectedShortfallCents` and `budgetOverrunCents` for the interface to display. For the pharmacy these are 300 and 1800.

## 6. Sessions

No login. An httpOnly, SameSite=Lax cookie named `nac_session` holds a random UUID. `GET /api/state` creates a seeded session if the cookie is missing or unknown. Reset creates a new session and replaces the cookie, so append-only tables never need deletion. Sessions start with balance 28000 and no mandate.

## 7. HTTP API

All routes return JSON. Errors use `ApiError`. Types are in `src/lib/contracts.ts`.

| Route | Principal | Body | Result |
|---|---|---|---|
| `GET /api/state` | human | none | `DemoState` |
| `POST /api/human/grant` | human | optional numeric overrides, zod-bounded | `DemoState` |
| `POST /api/human/keep-rules` | human | `{ proposalId }` | `DemoState` |
| `POST /api/human/regrant` | human | `{ proposalId }` | `DemoState` |
| `POST /api/human/revoke` | human | none | `DemoState` |
| `POST /api/agent/run` | agent, server-side | `{ scenario }` | `DemoState` |
| `POST /api/demo/next-week` | simulator | none | `DemoState` |
| `POST /api/demo/reset` | none | none | `DemoState` |
| `POST /api/demo/attack` | simulator | `{ name: AttackName }` | `AttackResult` |
| `POST /api/webhooks/provider` | signature | signed raw body | `{ ok: true }` or 401 |

The simulated provider calls the same verified handler in-process, so no deployment-protection or origin issue can break the callback. It emits `authorized`, then `executed`. There is no artificial delay. A server-only scenario `timeout` produces `unknown` for tests.

## 8. Attack panel

Each attack creates its own throwaway seeded session with an active mandate, so an attack never disturbs the main demo. Each one goes through the real functions.

| Attack | Guardrail | Required result |
|---|---|---|
| `tampered_price` | G2 | Claim 100 cents on `offer-a`. Blocked by `offer_matches_server`. |
| `swapped_merchant` | G2 | Claim `spesa-lampo` on `offer-a`. Blocked. |
| `replay` | G3 | Same key twice. One payment. |
| `double_spend` | G3 | Two concurrent `offer-a` proposals with different keys. One allowed, one fails budget. |
| `agent_self_regrant` | G5 | Agent principal calls re-grant. Refused with `human_required`. |
| `pay_after_revoke` | G4 | Proposal is allowed, then revoked before `begin_submission`. Provider calls is 0. Reservation released. |
| `forged_callback` | G6 | Invalid signature. 401 path, payment state unchanged. |

`AttackResult.providerCalls` must be a real counter from the adapter.

## 9. Environment variables (names only)

`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `NEXI_GATEWAY_SECRET`, `PROVIDER_WEBHOOK_SECRET`.

The server calls one Postgres function over HTTPS, `public.nexi_gateway`. The function requires a server-only secret and dispatches only to the `nexi.api_*` functions. The original plan used a direct pooler connection, but the pooler timed out from the build network. Each gateway call is one Postgres transaction.

## 10. Acceptance tests

Vitest runs the migration in PGlite and proves:

1. The full section 3 sequence, with each balance, budget, reach, and rule set.
2. `offer-c` and `spesa-lampo` block. Credit funding blocks.
3. Expired, revoked, and stale-version mandates block.
4. Non-positive amounts and wrong currency block.
5. Same key replays. Same key with different data conflicts.
6. Blocked and `request_approval` decisions make 0 provider calls.
7. Sequential reservations cannot exceed budget or buffer.
8. `authorized`, `requires_action`, and `unknown` do not settle. `failed` releases.
9. Repeated provider event has no second effect. Mismatched amount is rejected. Forged signature is rejected.
10. One-time grant cannot be used twice or on another offer. Terms restore afterwards.
11. Revocation does not alter executed payments.
12. Every attack in section 8 reports `stopped: true`.
13. `UPDATE` and `DELETE` on `audit_events` and `ledger_entries` fail.

PGlite has a single connection, so it cannot prove true concurrency. The concurrency check must also run against real Postgres after deployment. Record the result in the test log.
