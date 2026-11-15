# Hostinger SMTP: implementation and approval gates

Sender and login: `staypunch@salespunch360.com`; server: `smtp.hostinger.com:465`; implicit TLS with certificate and hostname verification and minimum TLS 1.2. SMTP must never use the Super Admin or database password. Credentials stay in private environment settings, never in Git or chat.

## Current safe default

`EMAIL_SENDING_ENABLED` defaults to **false**. With that value, `npm run email:deliver` exits before opening either a database or SMTP connection. Merging this code does not run a migration, change production secrets, start a schedule, or send a test or queued email. The web application continues to enqueue using its existing columns, so the worker-only additive migration can remain unapplied until approved.

The worker uses only restricted `stay_mailer` credentials. It refuses another or elevated database role, cannot read users/auth tokens, and receives neither a migration-owner URL nor a Super Admin password. Keep mailer/SMTP secrets out of the Hostinger web app's environment; the protected manual batch workflow provides a separate worker process.

## Exact production steps — each requires approval

1. **Configure private SMTP test secrets** in GitHub Environment `staypunch360-production`:
   - `STAYPUNCH_SMTP_PASSWORD`: password for the confirmed Hostinger mailbox.
   - `STAYPUNCH_SMTP_TEST_RECIPIENT`: the specific approved test inbox.
     Keep `EMAIL_SENDING_ENABLED=false` (or absent, which defaults to false). No secret is changed by the implementation.
2. **Verify TLS/authentication without sending** using `manual-smtp-check.yml` on `main`, mode `verify`, confirmation `VERIFY-STAYPUNCH-SMTP`. No database credentials or account tokens are used by this job.
3. **Send one controlled token-free email**, only after separate approval, using that workflow with mode `send-test`, confirmation `SEND-STAYPUNCH-SMTP-TEST`. This cannot drain the outbox. Confirm actual inbox receipt, sender identity and SPF/DKIM/DMARC results. SMTP acceptance alone is insufficient. Any DNS changes require their own review and approval; preserve existing email/verification records.
4. **Apply the reviewed additive database migration**, after approval, through the existing `manual-database-migrate.yml` on `main` with confirmation `MIGRATE-STAYPUNCH360`. `20261115232412_smtp_delivery_safety.sql` adds a nullable attempt timestamp/index and only the required `stay_mailer` column grants. It changes no existing message body, account, password, business row or app token. The updated mailer grant file also supports future installations. Do not rerun role provisioning.
5. **Configure the separate worker** after approval:
   - GitHub Environment secret `STAYPUNCH_EMAIL_DATABASE_URL`: session-pooler URI for `stay_mailer.<project-ref>` on port 5432 with the existing URI-encoded mailer password, never the migration owner or app role.
   - Reuse existing `STAYPUNCH_DATABASE_CA_CERT` for verified PostgreSQL TLS. SMTP uses the normal public CA trust store separately.
   - Environment variables `EMAIL_BATCH_SIZE=10` and `EMAIL_MAX_PER_MINUTE=5` are conservative defaults, not a statement of the mailbox plan's allowance. Confirm Hostinger limits before enabling.
6. **Enable a bounded live batch**, only after credentials, receipt and migration checks succeed and the owner explicitly approves. Set Environment variable `EMAIL_SENDING_ENABLED=true`, then manually run `manual-email-delivery.yml` with `DELIVER-STAYPUNCH-AUTH-EMAILS`. The job requires the confirmation and stops before any connections unless the environment flag is true. No automatic schedule is included; scheduling requires separate approval.

CLI/private worker equivalents use `EMAIL_PROVIDER=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE=true`, `SMTP_USER`, `SMTP_FROM`, `SMTP_PASSWORD`, `EMAIL_DATABASE_URL`, verified database TLS and the same bounded limits. `APP_URL` remains the existing trusted public origin on the web producer. Never duplicate SMTP or mailer credentials into public client variables.

## Queue behavior and limits

- Existing reset, verification and invitation producers and hashed single-use token validation are preserved. Expiry is 30 minutes, 24 hours and three days respectively. Staff invitation requests are bounded per actor/property; reset/resend endpoints retain durable throttling and generic responses.
- The worker checks kind/creation time against the database clock. Expired links, legacy token links without correct kind metadata, exhausted retries and unreleased booking/cancellation mail are withheld and redacted. Older reset/verification queue rows are suppressed when a newer one for that recipient exists. Auth token validation remains authoritative: revoked or already-used links can never authenticate even if an older message is encountered.
- A transaction advisory lock and persisted attempt timestamps enforce a shared per-minute attempt cap across processes. Row locks prevent concurrent delivery of one row. Transient failures back off from 30 seconds; five attempts or permanent rejection dead-letter and redact the message. Global SMTP failures stop the batch; an authentication preflight occurs before any queue access.
- Stable Message-ID values aid correlation but SMTP does **not** guarantee deduplication. Acceptance followed by a lost database commit can lead to duplicate delivery. No unsafe replay endpoint or exactly-once guarantee is introduced.
- `sent` means accepted by SMTP, not delivered/read. Bounce processing and inbox delivery confirmation are separate. Never log bodies, tokens, passwords or raw SMTP responses. Review queue backlog and retention before approving general sending.

## Automated validation

A loopback TLS SMTP server uses ephemeral test certificates/credentials. Tests cover the three auth email kinds, TLS/authentication and hostname rejection, header injection, transient/permanent failures, disabled-by-default behavior, and the isolated single-message test mode. Database tests cover expiry/legacy suppression, supersession, durable shared rate caps, concurrency, retries and least privilege. Browser tests confirm generic reset responses and matching throttling for known/unknown accounts. No test contacts Hostinger SMTP or modifies production data.

Booking, Payments and OTA functionality remains disabled; no operational email producer is enabled.
