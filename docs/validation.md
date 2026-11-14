# Initial foundation validation (PR #2; historical)

For the current S1A evidence, see [stage validation](planning/stage-validation.md). This report records the earlier foundation baseline.

Validated locally on 14 November 2026 with Node 24.19.0, Next.js 16.4.6, PostgreSQL 17 and installed Chromium. CI is configured for Node 22 and a fresh PostgreSQL 17 service. Base revision: `e0bdf426f56f820c2ae2a2f5ee34fccd7d58ac8f`.

| Check                                              | Observed result                                                 |
| -------------------------------------------------- | --------------------------------------------------------------- |
| `npm run typecheck`                                | Passed, including Next route type generation                    |
| `npm run lint`                                     | Passed                                                          |
| `npm run format:check`                             | Passed                                                          |
| `npm test`                                         | 4 passed                                                        |
| `npm run test:integration`                         | 2 passed against real PostgreSQL with a restricted runtime role |
| `npm run build`                                    | Passed                                                          |
| `npm run test:e2e` against production `next start` | 3 scenarios passed; 24.7 seconds in final run                   |
| `npm audit --omit=dev --audit-level=high`          | 0 vulnerabilities reported                                      |
| `git diff --check`                                 | Passed                                                          |

Acceptance scenarios exercise all marketing routes, persisted enquiries, CSRF, registration, login, session flags, property/room configuration, cross-tenant and role denials, invitations/token reuse, password reset/session revocation, throttling, support, all dashboard routes, admin configuration, audit events and logout. They verify that even a database `released` state and plan/property grants cannot activate an unapproved booking module.

The final browser checks require the actual dashboard content, rather than accepting a generic error-page heading. Axe scans report no WCAG 2 A/AA or WCAG 2.1 AA violations on the homepage and representative hotel/admin dashboard pages. Viewports include 1440, 768 and 390 pixels, with no horizontal page overflow in checked views. The homepage desktop screenshot was also inspected visually.

Limits: automated scans are not a complete manual accessibility audit or penetration test. External email delivery, production infrastructure, DNS, OTA providers and MFA verification were not exercised or enabled. Use the pull request's GitHub check results for remote CI status; this document records local observations only.
