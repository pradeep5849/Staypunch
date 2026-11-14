# Backup, restore and future database migration

## Exercised local recovery

`npm run db:restore-drill` only accepts local loopback `TEST_DATABASE_OWNER_URL` and matching `TEST_DATABASE_URL` with `ALLOW_RESTORE_DRILL=true`. It refuses remote targets and never overwrites the source database. It exports a repeatable-read snapshot, writes a mode-0600 custom-format dump in a temporary directory, restores into a randomly named database, reconciles every public table's row count, checks unreleased module state and RLS, reapplies restricted runtime grants, and verifies anonymous tenant reads and reserved MFA access remain denied. It drops only its generated database and deletes the temporary dump afterward.

Use matching-version `pg_dump`/`pg_restore` binaries. In local Docker/CI, set `PG_TOOLS_CONTAINER` to the disposable PostgreSQL container; tools run inside it, using credentials through environment variables rather than command arguments. CI supplies the name of its disposable PostgreSQL container. Backup contents and passwords are not printed. The current test drill is capped at 64 MiB; it is a test, not a large-production backup service.

Example with owner/runtime test variables already supplied securely:

```
ALLOW_RESTORE_DRILL=true PG_TOOLS_CONTAINER=<local-postgres-container> npm run db:restore-drill
```

## Production backup policy — configuration and approval pending

The owner must choose database region, backup retention, encryption/access rules and approved RPO/RTO targets. Check the selected Supabase plan's actual backup/PITR retention and restore facilities; do not assume a tier or feature is enabled. Retain encrypted off-platform logical backups where approved. Logical dumps of app schemas do not substitute for full-instance/PITR recovery, infrastructure secrets, uploaded files or provider configuration. No final RPO/RTO commitment is invented.

Before an approved production restore: stop writers and workers, identify the recovery point, validate and securely copy the backup, restore to a separate staging/validation target, provision owner/runtime/mailer roles independently, apply reviewed grants, compare migrations/counts and business invariants, test tenant isolation and app flows, measure actual recovery time and obtain sign-off. Do not send restored queued emails during validation. Never overwrite production as part of an unreviewed drill. Retain rollback access to the original database until reconciled.

## Supabase → Hostinger VPS PostgreSQL migration procedure

1. Inventory versions, extensions, database sizes, RLS/policies/functions, role grants, connection limits and all externally stored files. This application currently uses standard PostgreSQL plus pgcrypto and independent authentication.
2. Provision an approved PostgreSQL version on the VPS with private/firewalled networking, verified TLS, monitored storage, tested backups and separate owner/runtime/mailer roles. Confirm infrastructure capacity and regional/compliance requirements.
3. Rehearse with a sanitized or approved snapshot in isolation. Use matching/newer dump tooling and custom-format dumps with `--no-owner --no-acl`; restore application `public` and `stay_private` objects. Do not copy Supabase-managed auth/storage schemas as if the app used them. Preserve original migration history and user password/token hashes; never transform them into new credentials.
4. Apply runtime and mailer grants on the target, configure CA certificates, run database readiness, tenant tests and the applicable acceptance suite. Reconcile row counts plus operational inventory/financial invariants once those modules exist. Restore files/secrets separately from approved secure backups.
5. Plan a maintenance window or explicitly designed replication/cutover. Freeze app writers and workers, take the final consistent snapshot, restore and reconcile, update server-only connection variables, restart and validate. Avoid dual writers, duplicate notifications and uncontrolled queue replay.
6. Obtain explicit approval before production data movement, cutover or DNS changes. Keep the old source read-only with a tested rollback plan until sign-off, then apply approved retention/deletion policies.

The local automated drill verifies current foundation recovery. It does not prove production PITR, live cutover, zero downtime or a future booking/finance restore invariant. Those require separate staging and operational evidence.
