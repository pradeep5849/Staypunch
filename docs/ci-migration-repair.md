# CI teardown and migration CA repair

## Findings

Both attempts of PR #8's Validate run (`43589837990`) failed in the populated-schema upgrade test with an uncaught PostgreSQL `57P01` / “terminating connection due to administrator command”. All eight other integration tests passed. That CI failure was separate from the production workflow's invalid-PEM failure.

The upgrade test and restore drill used idle `pg.Pool` connections, awaited `pool.end()`, then immediately executed `DROP DATABASE ... WITH (FORCE)`. In the locked pg-pool implementation, the pool removes clients from its internal list before their connection-end callbacks finish. The pool promise can therefore resolve while a PostgreSQL backend is still closing. Forced DROP then terminates that backend, producing a fatal error on the closing idle client and an unhandled pool error. Parallel database activity changes the timing; it is not evidence of a Supabase outage.

A local concurrent diagnostic reproduced the mechanism: all 90 pool shutdown promises resolved before the client-end event, and 16 forced drops produced administrator-termination errors. The corrected upgrade test subsequently passed all 10 stress runs across two concurrent workers, without retries.

PR #8's literal format-string correction is valid (`%s\n` rather than `%s\\n`) and was carried into this branch. The final workflow uses Node's native X.509 parser/file writer instead of shell escaping. It accepts normal LF/CRLF PEM and literal escaped newlines, validates every certificate in a bundle, rejects non-PEM trailing content and never prints certificate contents. Formatting normalization does not change certificate bytes or provide an alternate trust root.

## Changes

- Dedicated `pg.Client` connections for disposable target/app connections; shutdown awaits the client's actual connection-end acknowledgement.
- Asynchronous migration subprocess execution so the test's event loop can service database/socket events.
- Shared test-only cleanup helper: restricted generated database names, bounded wait for zero database connections, then ordinary DROP without FORCE. Active/stray connections cause a test failure instead of being killed.
- Restore cleanup also closes resources and removes temporary backup files when a cleanup error occurs.
- Regression tests exercise eight parallel database cleanups and prove that a deliberately open connection is not force-terminated.
- CA installation runs with built-in Node before dependency installation, writes a private 0600 file in a private temporary directory, exports only its path and removes it on workflow completion.
- Production workflow remains manual, uses the existing `staypunch360-production` environment and secret names, installs dev dependencies explicitly for tsx, preserves migration serialization and now refuses non-main refs.
- `DATABASE_SSL=true`, CA validation and the existing certificate/hostname verification configuration remain enabled. No `rejectUnauthorized:false`, no-verify mode, test suppression or test retry was added.

All existing SQL migration files and application modules are unchanged. The database-drop helper is only for locally scoped disposable tests; the production workflow does not call it.

## Local evidence

TypeScript, ESLint, formatting, 16 unit tests, 11 integration tests, production build, populated-schema upgrade assertions and the 32-table backup/restore drill passed. The upgrade stress check passed 10/10 runs without retries. GitHub CI is the authoritative result for the submitted commit and also runs the existing browser/API acceptance suite.

## Production verification

After the fix PR passes required checks and is merged, dispatch `manual-database-migrate.yml` on **main**, with `confirmation=MIGRATE-STAYPUNCH360`. The existing GitHub Environment injects `STAYPUNCH_MIGRATION_DATABASE_URL` and `STAYPUNCH_DATABASE_CA_CERT` directly into the runner; they are not downloaded, printed or changed by this repair.

Verify CA installation, dependency installation and migration completion from the run's step status and sanitized logs. A successful connection uses the existing strict PostgreSQL TLS configuration, so untrusted certificates or mismatched hostnames must still fail. A skipped workflow, a successful formatting-only test or a green application CI run does not count as production migration verification. The PR/final task report records the actual production run outcome separately.
