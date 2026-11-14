# Stage S1A — audit, roadmap and foundation readiness

## 1. Repository audit

Baseline: `main` at `5ed73a7`, containing merged foundation PR #2. Existing code was inspected and tested before significant new code. The [audit](repository-audit.md) distinguishes operational capabilities from screens, schemas and external configuration. The [source baseline](source-baseline.md) records the supplied PDF hash and the [pasted request](development-instructions.md).

The 146-item register's **baseline** classification is 1 completed/tested policy requirement, 21 partially implemented requirements, 111 not implemented, 12 primarily blocked by third-party approval and 1 primarily blocked by external configuration. These are broad PDF requirements, not counts of working foundation functions or released modules. For example, M-02 remains partial even though session revocation now works, because MFA/device/suspicious-login requirements remain open. Existing marketed capability is never inferred from a database table.

## 2. Existing functionality verified

Before implementation, type checks, lint, 4 unit tests, 2 PostgreSQL integration tests, the production build and all 3 existing production-server browser/API scenarios passed. Verified flows included public navigation/enquiries, registration, password login/reset/logout, room/profile setup, staff invitations, tenant and role denials, platform management and fail-closed module gates. Their functional behavior is preserved; staff invitations now additionally require email proof, supplied by the tests through a real disposable verification token.

## 3. Remaining gaps

Canonical inventory ledger, availability holds, rate plans/restrictions, reservations/PMS, folios, operational accounting/tax, real channel synchronization and every advanced module remain unimplemented. Email delivery, production Supabase/hosting verification and recovery configuration remain owner setup items. MFA, expanded operational roles, structured security-denial monitoring, privacy retention/offboarding and production SLO/alerting remain incomplete. No pilot, partner certification or legal sign-off is invented.

## 4. Full roadmap

The [39-module roadmap](roadmap.md) and [machine-readable module milestones](module-roadmap.json) map every approved module to dependencies, owner responsibility, first delivery stage and module-specific acceptance. The [146-requirement register](requirements-register.json) preserves stable IDs, descriptions, priorities and source stages, plus audit evidence and acceptance expectations. The PDF stages are preserved: S0 audit/design; S1A readiness; S1B inventory/rates; S2 direct booking/PMS core; S3 PMS operations/India billing; S4 distribution; S5 commercial growth/intelligence; S6 enterprise/expansion. No module was added, renamed, removed, merged or activated.

## 5. First stage implemented

S1A adds a single verified-TLS/timeout/pool configuration path for runtime, operator and mailer, independent of Supabase Auth. Runtime and email worker credentials are separated from the migration owner. All app tables have RLS; privileged helpers move to a private schema; explicit table/column grants replace runtime catch-all grants; simulated hosted roles lose table/helper access even when service_role bypasses RLS.

Account services now support 24-hour single-use verification, self-only resend, mailbox-proof invitation restrictions, safe session metadata, individual revocation and sign-out-all. Property setup remains available without production email configuration. Templates cover all six requested email responsibilities; only account workflows produce messages. The provider/worker records explicit acceptance, simulated outcomes, retries/backoff and terminal failures, with stable idempotency IDs. Booking/cancellation templates do not enable transactions.

## 6. Database migration changes

Migrations 001–003 remain unchanged. A new CLI-created forward migration, `20261114053052_foundation_readiness.sql`, adds verification timestamps, opaque session IDs, outbox kind/attempt/receipt/retry metadata and an eligible-message index; moves privileged functions to `stay_private`; and hardens policies/ACLs/default privileges. There is no verification backfill or source-data deletion. Existing token/link lookup tables and password/session authentication are retained.

Apply the migration and both reviewed grant files together with the matching app version during an **approved maintenance window**: old binaries call public helper names that the new version intentionally stops exposing. Stop web writers/mail workers for the coordinated change, provision/review roles, apply grants and verify before resuming. This is not claimed to be a zero-downtime migration. The restore drill proves the current foundation can be restored into a separate local target, with no-owner/no-ACL restore followed by explicit grant hardening.

## 7. Security findings addressed and open

Addressed in this slice: potential legacy Data API exposure, public privileged helper execution, broad runtime privileges, owner credentials in the mail worker, inconsistent TLS, missing mailbox proof and missing self-service revocation. Automated tests verify local role/policy behavior, including untrusted API roles and a BYPASSRLS service role. Actual Supabase advisors and hosted TLS are pending because the owner will configure the project later.

Open: real MFA, expanded role editor/device controls, monitoring/denial events, per-edge abuse controls, nonce CSP, data retention/deletion and production backup/PITR decisions. Do not interpret this PR as a penetration-test certificate or complete production readiness.

## 8. Automated validation

Local validation uses Node 24, PostgreSQL 17 and Chromium, including a fresh database simulating legacy hosted grants and an upgrade of the previous local foundation schema. Unit coverage includes the exact 39/146 scope mapping, connection/TLS option rejection and provider boundaries. Integration coverage includes cross-tenant RLS, private-role/function denials, worker privilege isolation, actor cleanup, retries/dead-letter/concurrent claim behavior. Five production-server browser/API scenarios cover verification/session features and all existing foundation paths. The local restore reconciles all 32 tables, private helper ACLs, RLS, runtime isolation and zero released modules. Final command outcomes are recorded in [stage validation](stage-validation.md).

## 9–10. GitHub CI and pull request

This work is on `feat/foundation-readiness`, branched from the audited latest main. The implementation and this report are submitted together for review; the PR checks are the authoritative remote status. CI generates disposable database credentials, simulates hosted grants, runs all checks and recovery, and removes its database. No merge is authorized. See the final chat/PR checks for the PR URL and completed CI result rather than treating this report's local observations as remote evidence.

## 11. Owner configuration required later

Provide the approved Supabase project/region and restricted runtime, operator and mailer connection settings through secret storage; choose the actual direct/session endpoints and trusted CA where required; confirm Data API exposure is disabled and run hosted advisors. Configure/test a real email adapter, sender/domain authentication and private worker schedule. Confirm Hostinger Business Node support, application origins, capacity and deployment settings. Approve backup/PITR retention, RPO/RTO, privacy/legal terms and retention policy. No production passwords, API keys or SMTP settings are required to continue local development; never paste them into Git or reports.

## 12. Recommended next stage

S1B: canonical inventory and rate correctness, before enabling booking/PMS or distribution. Confirm pilot property timezone/currency, physical units vs pools/beds/resources, occupancy/child rules, hold TTL, authorized overbooking policy, restrictions/precedence, taxes, deposits and cancellation policies. Implement immutable inventory movements, atomic holds/release, deterministic rates and concurrency/idempotency tests. Keep remaining identity/operational-role/security gates explicit before any live operational release. Do not modify farmerssonresort.com, connect live providers, migrate production, deploy, change DNS or merge without the relevant explicit approval.
