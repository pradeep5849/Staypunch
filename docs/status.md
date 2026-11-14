# Requirements and development status

## Implemented foundation

- All requested marketing routes, shared navigation/footer, responsive homepage, interactive labeled mockup, FAQs, pricing, enquiry forms and legal draft pages. Blog is an honest unpublished empty state.
- Secure sign-in/sign-out, property account registration, operator admin bootstrap, persistent sessions, database-backed throttling, password reset with session revocation and single-use tokens.
- Property onboarding/profile, contact details, amenities, basic room type configuration, property selection for existing memberships, manager/staff invitations and scoped roles, account security view and subscription overview.
- Admin property approval/rejection/activation/suspension, customer suspension, configurable plans/features/prices/trials, plan assignment/renewal dates, leads/notes/assignment, support status/priority/assignment/replies and activity audit.
- Centralized roadmap preserving every existing module, development states, plan/property grants and source-enforced technical approval. Every operational module remains Coming Soon.
- PostgreSQL migrations, relational constraints, tenant RLS, indexes, transaction audit, email queue/worker boundary, validation scripts, CI and operator documentation.
- Real-record dashboard counts and customer registration growth. No fabricated revenue, customer or connection metrics.

## Explicitly incomplete / integration boundaries

| Capability                                                                       | Status                                                                                                           |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| PMS, bookings, inventory transactions, payments/refunds, channel synchronization | Coming Soon; no handlers                                                                                         |
| OTA catalogue and connection/error monitor                                       | Structure/UI only; real connections disabled by database constraint                                              |
| Revenue, conversion cohorts and feature adoption analytics                       | Not tracked; UI states this                                                                                      |
| Email                                                                            | Queued messages and configurable HTTPS worker implemented; actual delivery requires an operator-supplied adapter |
| Two-factor authentication                                                        | Reserved schema and security design only; no enrollment/verification                                             |
| Public blog                                                                      | No published content; empty state                                                                                |
| Privacy policy and terms                                                         | Draft content; operator/legal review required before launch                                                      |
| Billing/automatic renewal                                                        | Configured subscription state and dates only; no charging or renewal scheduler                                   |
| Advanced staff permission editor/platform-role grants                            | Fixed role matrix and operator bootstrap; no arbitrary role editor                                               |
| Branding                                                                         | Shared design and configurable company/contact information; logo/theme upload editor not included                |
| Multi-property management module                                                 | Coming Soon; data model/membership property selection supports the foundation                                    |
| Large-data list pagination                                                       | Current lists capped at 100; future pagination work                                                              |
| Production domains/deployment                                                    | Prepared/documented only; no DNS changes or deployment                                                           |

This is an initial platform foundation, not a complete PMS or a claim that every planned capability is shipped. Production launch depends on the documented external configuration and review items.
