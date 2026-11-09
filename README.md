# Agent Control

Student hackathon concept for Nexi (ESCP Turin, 9 November 2026). This is not a Nexi product or partnership.

A person grants an AI agent limited authority to buy essentials. The agent only proposes purchases. Rules in Postgres decide whether each purchase is allowed.

## What is real and what is simulated

| Part | Status |
|---|---|
| Rules, reservations, idempotency, revocation, audit log | Real, in Postgres |
| Agent planner | Deterministic script, labelled in the interface |
| Payment provider | Simulated, labelled in the interface |
| Provider callback check | Real HMAC verification of a simulated provider's message |
| Merchants, offers, Elena, pay event, pharmacy request | Synthetic, labelled in the interface |

This prototype makes no claim of AP2 compliance, legal compliance, production security, or general fraud prevention. The audit log is append-only at application level. It is not cryptographic proof.

## Run

1. Copy `.env.example` to `.env.local` and fill in the values.
2. Run `npm install`, then `npm run dev`.
3. Run the tests with `npm test`.

Set `NEXT_PUBLIC_UI_PREVIEW=1` to run the interface on local fixture data with no database. The header then shows "UI preview: gate not connected".

## Environment variables

`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `NEXI_GATEWAY_SECRET`, `PROVIDER_WEBHOOK_SECRET`.

## Limitations

- Revocation cannot recall a payment after submission has started.
- The simulator buttons drive events. There is no continuously running background agent.
- Sessions are per browser, with no login.
- If a server call stops between the gate decision and submission, the reservation stays held until the session is reset.
- The specification is in `.plans/hackathon-spec.md`. Test results are in `tests/TEST_LOG.md`.
