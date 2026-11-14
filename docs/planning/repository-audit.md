# Repository audit and gap analysis

Audited baseline: latest `main`, `5ed73a7` (merged PR #2), 14 November 2026. No prior code was replaced. Inspection covers the actual handlers, SQL policies/grants, worker, tests, release checks and product reference. Status describes evidence, not screen availability.

## Verified existing foundation

| Capability                                                   | Classification                                           | Evidence / remaining boundary                                                                                                                       |
| ------------------------------------------------------------ | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public website, enquiries and pricing configuration          | Completed and tested for foundation scope                | Public navigation, lead database assertions and admin plan updates in browser/API acceptance suite; blog empty, legal drafts                        |
| Password login/logout, cookies and reset                     | Completed and tested for these flows                     | bcrypt, token hashes, exact-origin checks; reset revokes sessions; MFA not implemented                                                              |
| Property registration/profile/amenities and basic room types | Completed and tested for foundation scope                | Persistent registration/profile/room tests; no availability or inventory ledger                                                                     |
| Staff invitations and owner/manager/staff permissions        | Completed and tested for these flows                     | Email-bound single-use invitations and owner/staff negative tests; no full operational-role editor                                                  |
| Platform property/customer/plan/lead/support management      | Completed and tested for foundation scope                | Separate platform checks and real-record interface tests; no billing collection                                                                     |
| Tenant isolation                                             | Partially implemented                                    | Existing API checks and selected-table RLS deny cross-property access; not every private table has RLS; broad runtime grants need replacement       |
| Module catalogue / activation policy                         | Completed and tested for fail-closed policy              | Exactly 39 approved modules, empty technical-approval catalogue, operational endpoint denied even with database grants; no module is Live           |
| Database portability                                         | Partially implemented / production configuration blocked | Standard PostgreSQL migrations exist; migration/worker SSL parity, pool bounds, grant portability and hosted exposure checks missing                |
| Email                                                        | Partially implemented / production configuration blocked | Reset/invitation queue and webhook worker exist; no common provider/template interface, verification flow, bounded retries or dedicated worker role |
| Backup and recovery                                          | Not implemented beyond guidance                          | No existing reproducible restore drill or recorded restore evidence                                                                                 |
| Booking/PMS/rates/ledger/finance/operations/AI               | Not implemented                                          | Catalogue/table names and descriptions do not constitute operational features                                                                       |
| OTA/PSP/WhatsApp/Google/GDS                                  | Blocked by third-party approval and implementation       | Catalogue/contract shapes only; require credentials, authorization, certification and e2e evidence                                                  |

The machine-readable register classifies all 146 PDF requirements. Broad requirements remain partial even where one sub-capability is tested. No complete module release or pilot approval is inferred from a working foundation page.

## Security findings and stage actions

1. **High: hosted Data API exposure risk.** Legacy Supabase projects may auto-grant public-schema tables to `anon`/`authenticated`. Private account/session/outbox tables currently lack RLS; SECURITY DEFINER helpers default to PUBLIC execution. Before hosting: deny Data API roles, protect every app table, move privileged helpers to an unexposed schema and explicitly grant only the server role. No live Supabase project has been accessed or demonstrated vulnerable.
2. **High: broad runtime/worker privilege.** Runtime grants use `ALL TABLES`, and the email worker requires the migration owner. Replace with explicit table/column grants and a separate mailer role. The web role must not own objects or bypass RLS. Keep migration-owner credentials out of the web and delivery worker.
3. **Medium: account verification absent.** Users can register an arbitrary email. Add short-lived, hashed verification tokens and single-use confirmation; show verification state without blocking unrelated foundation work. Require mailbox proof before sending staff invitations or using a future operational module. Invitation acceptance itself can attest the invited mailbox.
4. **Medium: account session controls incomplete.** Reset revokes sessions but users cannot review or revoke individual sessions. Add scoped opaque session IDs, self-service revocation and explicit sign-out-all. Do not expose token hashes or other customers' sessions.
5. **Medium: database configuration parity.** Only runtime pool applies `DATABASE_SSL`; migration/bootstrap/worker use different connection setup. Unbounded connection waits and URL SSL options need fail-closed parsing and verified TLS shared by all processes.
6. **Medium: email delivery reliability.** The worker stops on the first error without recorded attempts/backoff. Add provider interface, queued/retry/dead-letter outcomes, idempotency and test transport. Delivered claims require a provider receipt; a test transport is explicitly simulated.
7. **Open, outside this slice:** real MFA, operational role expansion, structured denial/security monitoring, privacy retention/offboarding, full request-abuse edge controls, nonce CSP, production at-rest controls and restore/PITR operations. Track these as incomplete, not silently resolved.

## Selected first incomplete foundation slice: S1A

Implement database/Supabase readiness hardening, verification and session management, reusable email/provider boundaries and a local backup/restore drill. Preserve existing authentication rather than introducing Supabase Auth. Keep the existing migrations immutable and add a forward migration. Do not add bookings, rate plans, availability allocation, payment logic, OTA adapters or module approvals in this PR.

The next foundation slice S1B implements canonical inventory and rate foundations before any direct booking/PMS release. The PDF's concurrency, idempotency and immutable-ledger requirements are mandatory exit gates for that later slice, not claims about this one.
