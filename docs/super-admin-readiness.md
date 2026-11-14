# Stage S1B — Super Admin readiness (Issue #11)

## Existing architecture

The shared `/login` form verifies the existing bcrypt password in PostgreSQL, creates a hashed server-side session, and redirects `super_admin` users to `/admin`. Other users go to `/app`. All admin pages and mutations check the current active database user and role. Expired/revoked sessions fail closed; changing or suspending a role takes effect on subsequent requests. The login page redirects an already authenticated user to their workspace. Logout deletes the server session and returns to `/login`.

There is no second authentication system or email-based admin bypass. Existing account passwords and verification state are preserved. Super Admin access uses the database role; an unverified administrator is not silently marked verified.

The existing foundation screens provide platform counts, property status/profile management, customer user status, subscription assignments, plans, support, audit and system/company settings. The Users navigation item retains `/admin/customers`; platform staff remain listed in Settings and cannot be promoted through a customer form. All 39 planned modules are browsable in the sidebar and link to their Coming Soon cards. Release gates remain unchanged, including booking, payments and OTA operations.

## Verified production configuration gap

Read-only checks on 14 November 2026 confirmed:

- Supabase project `urprqbipwzzezwaodriy` is healthy; `sales.amjconsterior@gmail.com` exists, active, with role `super_admin` and an existing password hash. No account/password changes were made.
- Hostinger site `ivory-goat-945051.hostingersite.com` tracks `pradeep5849/Staypunch`, branch `main`, with automatic deployment enabled and Node 22 / Next.js builds succeeding.
- That site's Node.js environment variable list is empty. GitHub Environment secrets are **not** automatically available to Hostinger.
- PostgreSQL has neither the `stay_app` nor `stay_mailer` role. Do not solve this by copying the migration owner URL into the web runtime.

These hosting/database provisioning steps are necessary before a real production login can succeed.

## Required operator settings

1. In a secure PostgreSQL operator session, provision the existing architecture's `stay_app` and `stay_mailer` LOGIN roles with independently generated passwords, NOSUPERUSER and NOBYPASSRLS, without object ownership. Apply the already-reviewed `db/runtime-grants.sql` and `db/email-worker-grants.sql` (`npm run db:grants` with the operator URL outside the web server). See [database readiness](database-readiness.md). Preserve all migrations and data; do not rerun bootstrap or reset the Super Admin password.
2. In Hostinger → the exact site above → Node.js environment settings, set the following privately. Save existing real values when editing; the API replaces the whole environment set and masked values must never be copied back.

| Variable              | Required setting                                                                                                                                                                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`        | Supabase session pooler/direct URI for **stay_app**, with its URI-encoded password; never `postgres`/migration owner. For Supabase's shared pooler, use the custom role/project username shown in its connection instructions (`stay_app.<project-ref>`). |
| `DATABASE_SSL`        | `true`                                                                                                                                                                                                                                                    |
| `DATABASE_CA_PEM`     | Project's downloaded trusted CA PEM, with real or escaped newlines; certificate and hostname checks stay enabled. Alternatively provision a readable `DATABASE_CA_CERT_FILE`, but never set both.                                                         |
| `APP_URL`             | `https://ivory-goat-945051.hostingersite.com` while using this production hostname. This is also the origin for account email links.                                                                                                                      |
| `APP_ALLOWED_ORIGINS` | Optional comma-separated exact HTTPS origins only when additional approved UI domains are attached, e.g. the admin and app subdomains. Never use wildcards.                                                                                               |
| `DATABASE_POOL_MAX`   | Optional, default `5`; size to the Supabase connection budget.                                                                                                                                                                                            |

Hostinger supplies production mode for the built Next.js server. Keep migration, bootstrap and test credentials out of its web environment. Email worker configuration is separate; real verification/reset email delivery is still subject to the existing delivery readiness gate.

3. Run `npm run db:check` with the restricted runtime connection and trusted CA in a secure operator environment. Rebuild/restart the Hostinger application after saving settings, and confirm it is running the merged commit.
4. Sign in with the unchanged existing Super Admin password. Alternatively run **Manual StayPunch360 deployed admin readiness** on `main`: it uses the existing protected `STAYPUNCH_BOOTSTRAP_ADMIN_PASSWORD` secret only as a login credential, never runs bootstrap, and checks HTTPS login, secure cookie flags, dashboard sections and logout revocation. The secret must match the unchanged account password. The workflow never prints credentials, cookies, response bodies or database records. A failed readiness run leaves the issue open for operator setup.

Public origins are explicitly configured for reverse-proxy HTTPS termination. Forwarded host/protocol headers cannot add a trusted CSRF origin. Missing production origin configuration fails closed. Host-only cookies require signing in separately on an attached admin hostname.

## Validation

The normal Validate workflow runs TypeScript, lint, formatting, unit tests, migrations, RLS/integration tests, backup/restore, production build and browser/API acceptance using disposable PostgreSQL and the restricted runtime role. The added admin acceptance test covers real browser sign-in/redirect, existing session redirect, all 39 module links, mobile/tablet/desktop overflow, secure cookies, bad credentials, expired sessions, role changes, suspension and logout replay denial. Existing acceptance checks exercise property/user/subscription management and settings screens.

Production readiness is a separate result from code CI: successful builds cannot establish database connectivity when Hostinger has no runtime settings.
