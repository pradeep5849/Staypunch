# Stage S1A validation evidence

Validated locally on 14 November 2026 with Node 24.19.0, PostgreSQL 17, Next.js 16.4.6 and installed Chromium. Audited base: `5ed73a7`. Credentials were generated for a disposable Docker fixture and were not committed. CI repeats this workflow on Node 22.

| Check                                               | Observed local result                                                                                                 |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| TypeScript + Next route generation                  | Passed                                                                                                                |
| ESLint                                              | Passed                                                                                                                |
| Prettier check                                      | Passed                                                                                                                |
| Unit tests                                          | 12 passed                                                                                                             |
| Real PostgreSQL integration tests                   | 9 passed                                                                                                              |
| Database readiness                                  | Passed                                                                                                                |
| Backup/restore drill                                | Passed: 32 tables reconciled, RLS and private-helper ACLs retained, runtime isolation verified, zero released modules |
| Production build                                    | Passed                                                                                                                |
| Production-server browser/API suite                 | 5 passed                                                                                                              |
| Production dependency audit                         | 0 vulnerabilities reported                                                                                            |
| Existing 001–003 migrations and 39-module catalogue | Unchanged; scope test also checks the 146-item register                                                               |

Fresh-install tests simulate legacy Supabase default table grants and a BYPASSRLS service_role, then verify the hardening removes access. A separate populated-baseline upgrade test applies the original three migrations first, seeds an account, property, session, reset token and queued message, then runs the forward migration and explicit grants. It confirms their data survives and no account is silently email-verified. Recovery tests use a separate random target and delete only the drill's temporary database and backup.

The five browser/API scenarios include verification expiry/single use, self-only resend, scanner-safe GET, actual confirmation form submission, unverified property setup, invitation proof, session metadata privacy, cross-user revocation denial and immediate sign-out, as well as every prior foundation scenario. Representative accessibility/responsive checks remain part of the preserved acceptance suite.

These are local observations, not a claim that a real Supabase project or SMTP/OTA/PSP connection was tested. Actual hosted security advisors, verified remote TLS, production email acceptance/delivery/bounces, Hostinger runtime settings, production recovery/PITR and pilot approval remain pending configuration. The PR's GitHub check result is authoritative for remote CI; no production deployment, merge or DNS change was performed.
