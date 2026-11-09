Verification environment: Windows, Node 24.15.0, Vitest 5.1.0, PGlite 0.5.15.

The suite applies the real migration to fresh PGlite databases. Tests exercise
the production planner, principals, executor, payment adapter, HMAC verifier,
HTTP handler factory, and database functions. No tests are skipped. Provider
credentials are explicit test values; no database credential is used.

Verified during implementation:

- The initial full suite passed 41/41 tests.
- The final boundary and privilege review passed 8/8 targeted tests.
- `npx tsc --noEmit` passed with exit code 0.

Final verification (2026-11-09):

- `npm test`: PASS, 4 test files, 48 tests passed, 0 failed, 0 skipped
  (50.44 seconds).
- `npx tsc --noEmit`: PASS, exit code 0, no diagnostics.
- No package installation, commit, push, or deployment was performed.

Created files:

- `supabase/migrations/0001_gate.sql`
- `src/server/attacks.ts`
- `src/server/backend.ts`
- `src/server/db.ts`
- `src/server/errors.ts`
- `src/server/executor.ts`
- `src/server/http.ts`
- `src/server/payments/index.ts`
- `src/server/planner.ts`
- `src/server/principals.ts`
- `src/server/runtime.ts`
- `src/server/session.ts`
- `src/server/types.ts`
- `src/server/README.md`
- `src/app/api/state/route.ts`
- `src/app/api/human/grant/route.ts`
- `src/app/api/human/keep-rules/route.ts`
- `src/app/api/human/regrant/route.ts`
- `src/app/api/human/revoke/route.ts`
- `src/app/api/agent/run/route.ts`
- `src/app/api/demo/next-week/route.ts`
- `src/app/api/demo/reset/route.ts`
- `src/app/api/demo/attack/route.ts`
- `src/app/api/webhooks/provider/route.ts`
- `tests/acceptance.test.ts`
- `tests/boundaries.test.ts`
- `tests/http.test.ts`
- `tests/migration.test.ts`
- `tests/helpers.ts`
- `tests/TEST_LOG.md`
- `vitest.config.ts`
- `.env.example` (present on disk; matched by the existing `.env*` Git ignore)

Changed existing file: only the scripts field in `package.json`, adding
`"test": "vitest run"`. Shared contracts and frontend files were not edited.

No functional specification deviations. Internal transport/command types absent
from the UI contracts live in `src/server/types.ts`: Principal, ProposalInput,
Submission, BeginResult, GrantOverrides, PlannerContext, ProviderState,
ProviderEvent, and PaymentRequest. The revocation limitation is documented in
`src/server/README.md`, within the allowed file scope.

The initial default Vite configuration attempted a Windows `net use` subprocess,
which the sandbox refused with EPERM. The final config has no config-time imports
and uses worker threads. Plain `npm test` works without extra flags, installs,
test exclusions, or dependency modifications. The `server-only` marker is mapped
to Next's own server-side empty module in Vitest.

Real Postgres concurrency: NOT RUN. There is no database credential and no
deployment was requested. PGlite serializes its single connection, so concurrent
Promise.all calls demonstrate sequential reservation safety only. The following
must be verified against real Postgres after deployment, using independent
connections and a fresh granted session for each case:

1. Submit two offer-a proposals concurrently with different idempotency keys.
   Expect exactly one allow, one request_approval with budget_remaining and
   balance_above_buffer failures, 5800 reserved cents, and one payment row.
2. Submit identical proposals concurrently with the same key. Expect the same
   proposal/payment IDs and one replay. Repeat with changed data under the same
   key and expect idempotency_conflict.
3. Call api_begin_submission concurrently for the same allowed payment. Expect
   exactly one started=true and only one provider invocation by the executors.
4. Race a revoke against begin_submission. If revoke commits first, expect a
   blocked payment, zero provider calls, and released funds. If submission begins
   first, revocation cannot recall the provider call; a verified callback may
   settle it. In either order, revocation must never change completed payments.

The row locks and unique constraints implementing these guarantees are present
in the migration. Their behavior under true multi-connection concurrency remains
an explicit unverified item.

## Live checks against real Postgres (2026-11-09, run by Claude through the running app)

- Full demo sequence: every balance, budget, reach, and failed rule set matched section 3 of the spec.
- Replay of `weekly_basket`: one payment.
- All 7 attacks reported `stopped: true`.
- `double_spend` repeated 12 times over separate HTTP requests: stopped 12 of 12.
- These are prototype checks. They are not a security audit.
