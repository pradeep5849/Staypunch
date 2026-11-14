# Validation

Use a disposable PostgreSQL database. The integration/browser suites create users, properties, plans, tickets and leads, and the email tests truncate the test outbox. Never point these suites at production. The restore drill refuses nonlocal targets and requires explicit test opt-in.

1. Provide a separate owner connection as `MIGRATION_DATABASE_URL`; create local stand-in `anon`, `authenticated` and `service_role` roles for hosted-exposure tests. CI creates a disposable Docker database with generated credentials and deliberately simulates legacy default grants before migrations to test their removal. No real Supabase project is needed.
2. Run `npm run migrate`, provision restricted `stay_app` and `stay_mailer` logins, and apply `db/runtime-grants.sql` and `db/email-worker-grants.sql` as owner. Do not share owner credentials with either service.
3. `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build`
4. Run `npm run db:check` with the runtime `DATABASE_URL`.
5. Run `npm run test:integration` with `TEST_DATABASE_OWNER_URL`, `TEST_DATABASE_URL` and `TEST_EMAIL_DATABASE_URL` identifying the same disposable database through the three roles.
6. Run the local restore drill from [backup and restore](backup-restore.md), using matching-version pg tools or the test PostgreSQL container.
7. Start the built server with `DATABASE_URL=<runtime> APP_URL=http://localhost:3100 npm run start -- --port 3100`. Keep owner/mailer/test URLs out of that server environment.
8. Run `TEST_DATABASE_OWNER_URL=<owner> npm run test:e2e`. Set `TEST_BASE_URL` if using a different port; `APP_URL` must match. Use installed Chromium via `PLAYWRIGHT_CHROMIUM_PATH` or install the Playwright browser in CI.

Unit tests cover exact 39-module/146-requirement traceability, unapproved releases, field validation, remote TLS/URL override rejection, separate connection roles, all six email templates, provider receipts, retryable/permanent errors and explicit simulated outcomes.

Integration tests use real PostgreSQL and restricted roles to exercise tenant RLS, Data API/function denials (including a simulated BYPASSRLS service_role), no platform-role injection, no outbox/MFA exposure, queue-only mailer access, transaction-local actor cleanup, retries/backoff/terminal failure, concurrent worker claiming and idempotent test-provider handling. A populated-original-schema upgrade test verifies accounts, property data, sessions, reset tokens and pending email survive the forward migration without a verification backfill. The restore drill separately reconciles all 32 current tables and rechecks isolation/privileged-function ACLs after no-owner/no-ACL restore and grant reapplication.

The browser/API suite has five scenarios: two independent account-verification/session scenarios and three serial foundation scenarios. It checks verification expiry/reuse/self-only resend, GET scanner safety, the actual verification form, unverified setup, invitation restrictions, safe session metadata and cross-account/immediate revocation, plus all existing public, property and admin acceptance flows. Existing invitation tests now supply real test-token mailbox proof rather than bypassing verification. Only the foundation scenarios depend on one another; all five must pass.

No suite sends real email, creates a booking, charges money or contacts an OTA. Production Supabase advisors/TLS, delivery receipts/bounces, hosting configuration and pilot UAT remain separate checks after owner configuration/approval.

The two grant files can be applied atomically with `npm run db:grants` using the operator-only connection. This command reads credentials from the environment and does not place them in command arguments.
