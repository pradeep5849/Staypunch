# PostgreSQL / Supabase readiness

Initial production database target: Supabase PostgreSQL. Future target: Hostinger VPS PostgreSQL. No hosted project, account, schema or production data was accessed or changed in this stage. The application continues to use its own password/session authentication; no Supabase Auth SDK, JWT authorization or browser database keys are introduced.

## Connection roles

| Process                      | Variable                 | Required database identity                               |
| ---------------------------- | ------------------------ | -------------------------------------------------------- |
| Next.js server               | `DATABASE_URL`           | `stay_app`, NOSUPERUSER, NOBYPASSRLS, no table ownership |
| Migration/bootstrap operator | `MIGRATION_DATABASE_URL` | Dedicated trusted owner; direct or session connection    |
| Scheduled email worker       | `EMAIL_DATABASE_URL`     | `stay_mailer`, queue-only grants                         |

Set these through environment/secret settings, not source files. Never put the operator connection in the web or mailer process. All three processes use `lib/database-config.ts`. Local loopback PostgreSQL supports plaintext for development/CI; remote connections always require TLS with CA and hostname verification. `DATABASE_SSL=false` is rejected remotely. Unsafe/ambiguous URL `sslmode` values and certificate URL overrides are rejected so pg cannot silently override certificate verification. Use the platform-provided hostname and, when required, a trusted `DATABASE_CA_CERT_FILE` mounted read-only. Never use `rejectUnauthorized:false`.

`DATABASE_POOL_MAX` defaults to 5 (range 1–30); account for every Node instance when checking Supabase connection capacity. The operator and worker use one connection. Connections have a 5-second default timeout and statements are bounded. `DATABASE_CONNECT_TIMEOUT_MS` is configurable within validated limits.

For a persistent Hostinger Node process, prefer direct or session pooling using the actual hostname/port from the Supabase Connect panel and a custom restricted SQL role. Direct endpoints may require IPv6; session pooling is an alternative when only IPv4 is available. A transaction pooler is not appropriate for the migration runner's session advisory lock, so migration port 6543 is rejected. Runtime requests keep actor context in a single transaction using `set_config(...,true)` and use unnamed pg queries; transaction pooling must still be verified against the actual host configuration before selecting it. No connection string is invented here.

## Server-only database boundary

Use a dedicated project/database for this application. It does not consume PostgREST/GraphQL, Supabase Auth, Realtime or Storage. Prefer disabling the Data API for this project in its integration settings. Do not expose `stay_private` in the Data API schema list.

The forward migration enables RLS on every app table, removes application-table grants from `anon`, `authenticated` and `service_role` when those roles exist, and revokes PUBLIC execution of privileged helpers. It moves existing SECURITY DEFINER helpers into `stay_private`, preserving policy references and narrowing execution to the trusted application role. It also revokes future public-schema automatic grants for objects created by the migration owner. Supabase-managed `auth`/`storage` objects are untouched. Review these default-privilege changes before using a shared project with unrelated applications.

Tenant tables enforce actor/membership context; identity/configuration tables allow only the trusted backend SQL role, with column/table grants further limiting writes. This is not a customer-facing SQL credential or a replacement for API authorization. Mailer access is limited to reading/processing the outbox. Reserved MFA tables are inaccessible to both runtime and mailer.

1. Provision the approved project and owner connection later.
2. Run the existing migration runner once using the owner; migrations 001–003 are unchanged. The new timestamped migration was created with the Supabase CLI's local-only migration command, then placed in the existing `db/migrations` runner directory. Do not introduce a second migration-history system.
3. Create restricted `stay_app` and `stay_mailer` logins with owner-generated secrets outside Git, then apply `db/runtime-grants.sql` and `db/email-worker-grants.sql`. Grants use the current database name and work with Supabase's `postgres` database or a local/VPS name.
4. Set the runtime URL and run `npm run db:check`. Run hosted security/performance advisors when a real project is configured; local role/policy tests are not a Supabase advisor result.
5. Verify TLS, table/function ACLs, RLS and the Data API setting in the real project. No production use until those checks and deployment approval.

## Documentation checked

- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/docs/guides/platform/ssl-enforcement
- https://supabase.com/docs/guides/api/securing-your-api

Current documentation was retrieved through the Supabase documentation tool. The changelog endpoint returned HTTP 403 in this environment; no claim is made that hosted breaking changes or an actual Supabase project were validated. Local PostgreSQL and simulated hosted roles provide the stage's automated evidence.

The two grant files can be applied atomically with `npm run db:grants` using the operator-only connection. This command reads credentials from the environment and does not place them in command arguments.
