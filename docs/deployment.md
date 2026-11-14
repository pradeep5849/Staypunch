# Deployment preparation — no deployment performed

## Hostinger requirements

The owner-selected target is Hostinger Business Web Hosting. Verify that the actual subscription supports a persistent Next.js Node application and the selected Node 22+ runtime before deployment. A static/PHP-only shared hosting plan cannot run this backend. Confirm Node support and resources in hPanel before selecting deployment settings. The initial database target is Supabase PostgreSQL, with Hostinger VPS PostgreSQL planned later. Standard hosting MySQL is not a substitute. See [database readiness](database-readiness.md). No paid vendor is required by this code; assess infrastructure costs separately.

Build with `npm ci && npm run build`. Start with `npm run start -- --port <assigned-port>` using the host's supplied port. Configure reverse-proxy HTTPS and health monitoring. Deploy the same source revision to all host routes, or map all approved hostnames to the same Node application if the hosting plan supports it. Keep the database private where possible, size the connection pool for host limits, and use `DATABASE_SSL=true` for a remote verified-TLS database. Never disable certificate checks.

## Database and secrets

The operator exports `MIGRATION_DATABASE_URL` outside the web runtime and runs `npm run migrate`. Create a dedicated `stay_app` login with an operator-generated password using a secure provisioning session; apply `db/runtime-grants.sql` after migrations. The grant script derives the current database name. Provision a separate `stay_mailer` role and apply `db/email-worker-grants.sql`. The app role must be NOSUPERUSER, NOBYPASSRLS and not a schema/table owner. MFA reserved tables are intentionally not granted to the current application. Use only the restricted `DATABASE_URL` in the web runtime.

Bootstrap the first administrator with the documented environment-only procedure. Remove bootstrap secrets and the owner URL afterward. Store email adapter credentials only in the worker environment, and verify token-delivery behavior using a real test mailbox before production signup. The adapter must accept an idempotency key and avoid duplicate sends. Run the worker on a private scheduler; its current batch size is 50.

## Domain map

| Hostname                               | Prepared behavior                                                          |
| -------------------------------------- | -------------------------------------------------------------------------- |
| staypunch360.com, www.staypunch360.com | Public website                                                             |
| admin.staypunch360.com                 | Platform UI, server-authenticated                                          |
| app.staypunch360.com                   | Property UI, server-authenticated                                          |
| book.staypunch360.com                  | 503, unreleased                                                            |
| api.staypunch360.com                   | 503, unreleased; same-origin `/api/*` on UI hosts supplies foundation APIs |

Set `APP_URL=https://app.staypunch360.com` for verification/reset/invitation links. Login uses host-only cookies; a customer session is not automatically shared with the admin host. The platform admin signs in on the admin host. API requests stay same-origin. Configure the proxy to preserve the original Host and Origin, terminate TLS correctly, and reject unrecognized hosts at the edge.

DNS changes, domain attachment, SSL provisioning and production deployment are intentionally not performed. Once explicitly authorized, verify the hosting plan, back up DNS records, preserve email/verification records, validate the app on a staging hostname, then provision the approved DNS/SSL configuration. No instructions here authorize changing production.

## Launch checklist

Run the exact validation workflow on a disposable database, back up production and apply migrations using the owner. Verify role privileges and cross-tenant denial. Configure company contact information, prices and terms without claiming unfinished module availability. Finish privacy/terms legal review, select retention periods, configure delivery and edge throttling, verify HTTPS cookies and host routing, and test restores. Confirm responsive UI, reset email receipt and staff invitation receipt. Keep all planned modules disabled. Merge and deploy only after explicit approval.

## Stage S1A additions

Follow [database readiness](database-readiness.md), [email contract](email-readiness.md), and [recovery/migration procedures](backup-restore.md). Use separate URLs for runtime, operator and mailer; never share the migration-owner connection with the web or email worker. All use the verified-TLS configuration parser. Run `npm run db:check` before any approved deployment. Legacy account verification state is not silently trusted; owners can request confirmation in account settings. Session revocation is self-service. MFA, real email delivery and operational module activation remain outstanding.

The two grant files can be applied atomically with `npm run db:grants` using the operator-only connection. This command reads credentials from the environment and does not place them in command arguments.
