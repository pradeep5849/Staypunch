# Validation

Use a disposable PostgreSQL database. Never point the integration/browser suites at production: they create named test users, properties, plans, tickets and leads and intentionally exercise account changes. Set the owner connection for setup/assertions and a separate restricted application connection for the running server.

1. `MIGRATION_DATABASE_URL=<owner> npm run migrate`
2. Provision `stay_app` and apply `db/runtime-grants.sql` with the owner.
3. `npm run typecheck && npm run lint && npm test && npm run build`
4. `TEST_DATABASE_OWNER_URL=<owner> TEST_DATABASE_URL=<runtime> npm run test:integration`
5. Start the server with `DATABASE_URL=<runtime> APP_URL=http://localhost:3100 npm run dev -- --port 3100` (or use the production build with `npm run start -- --port 3100`).
6. `TEST_DATABASE_OWNER_URL=<owner> npm run test:e2e`. Install Playwright Chromium if absent; set `PLAYWRIGHT_CHROMIUM_PATH` to an installed Chromium when appropriate. The cloud environment used `/usr/bin/chromium`.

Unit tests cover catalogue preservation, unapproved release denial and validation boundaries. PostgreSQL integration tests run with a NOSUPERUSER/NOBYPASSRLS role and assert cross-tenant reads and writes are blocked. Browser/API tests exercise public routes, responsive widths, axe accessibility, lead persistence, CSRF, account registration, password login, cookie flags, property/room setup, owner/staff/admin permissions, invitation redemption, password reset, token reuse, throttling, support and admin configuration.

The e2e scenarios are serial because later management assertions operate on records created by the onboarding scenario. A failed prerequisite skips dependent tests. All three must pass for the suite to count as successful. These tests do not call external email or OTA providers.
