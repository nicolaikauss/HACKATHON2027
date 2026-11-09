This is a student prototype with synthetic people, merchants, offers, pay events,
and pharmacy requests. The planner is a deterministic script. Payments are
simulated. Policy enforcement, reservations, replay protection, and HMAC callback
verification run for real. This is not a Nexi product or partnership and makes no
AP2, legal-compliance, production-security, or general fraud-prevention claim.

Apply `supabase/migrations/0001_gate.sql` as a migration owner. Configure
`DATABASE_URL` and `PROVIDER_WEBHOOK_SECRET` using `.env.example`. Grant `nexi_app`
to the server login role; do not use a database owner or Supabase service-role
credential as the application's connection identity. The driver uses
`prepare: false` and `max: 1` for the transaction pooler. No credentials are
required for the PGlite tests.

The migration owns every policy and ledger rule. TypeScript chooses the cheapest
eligible offer and orchestrates the resulting payment. Agent tools expose only
offer reading and proposal submission. Human operations enforce the explicit
principal before database access. HTTP routes derive principals and sessions on
the server; they never accept these from request bodies.

Callbacks use a hex HMAC-SHA256 in `x-provider-signature`, computed over the exact
raw UTF-8 JSON body. Both HTTP callbacks and simulated in-process deliveries use
the same verifier. Callback fields are `eventId`, `reference`, `amountCents`,
`currency`, `bindingHash`, and `state`. Invalid signatures receive 401 before
parsing or database access. Provider-call counters count submissions, not events.

Revocation cannot recall a payment after `begin_submission` has succeeded.
Revocation does not change completed payments. An unknown outcome retains its
reservation and is never retried automatically. A later verified terminal event
may resolve it. The simulator refuses to advance periods while reservations are
outstanding. Audit and ledger tables reject UPDATE and DELETE at application
level; they are not cryptographic proof against a database administrator.

`tests/TEST_LOG.md` records verification and the remaining real Postgres
concurrency check. PGlite has one connection and cannot prove concurrent row-lock
behavior. Run the same concurrent proposal and duplicate submission scenarios
against separate real Postgres connections after deployment.
