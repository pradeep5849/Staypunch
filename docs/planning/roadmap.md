# Dependency-based implementation roadmap

The consolidated PDF is the primary product baseline. Its stages 0–6 are preserved; Stage 1 is split into S1A (readiness/security/account services) and S1B (inventory/rate correctness). The pasted suggested sequence is guidance, not a replacement for the PDF's operational dependencies. Some modules span several stages: the table marks their first substantive delivery stage, and full acceptance remains in the machine-readable roadmap/register.

| Stage                                         | Dependency and milestone                                                                                                                   | Acceptance / exit gate                                                                                                                                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S0 — Audit and design                         | Current foundation + source baseline; 39 module / 146 requirement traceability; ADRs and pilot questions                                   | Evidence-based audit, explicit gaps, full mapping, owner/pilot decisions documented; no invented pilot inputs                                                                                                         |
| S1A — Foundation readiness (this PR)          | Existing identity/tenancy/UI; Supabase-compatible PostgreSQL access; email provider boundary; verification/session controls                | Existing suites preserved; Data API/privilege denials tested; token reuse/expiry/isolation tests; provider failure/retry/idempotency tests; restore exercised on disposable DB                                        |
| S1B — Inventory and rate foundations          | S1A + pilot inventory model; distinct room types/units/beds/resources; canonical movement ledger, holds, rate plans/restrictions/precision | Parallel last-room requests yield exactly one hold; expiry/cancel release once; tenant denials; deterministic rates/taxes and stale quote invalidation; pilot review                                                  |
| S2 — Direct booking and PMS core              | S1B; guest/consent model; hosted/widget journey; reservation state machine; PSP boundary and folios                                        | Quote → hold → verified payment → confirmation; replay produces one booking/posting; uncertain payments reconcile; modify/cancel/refund tests; Farmers Son Resort integration design only until separately authorized |
| S3 — PMS operations and India billing         | S2; business date/immutable day-close; housekeeping/maintenance; guest service and operational reports                                     | Pilot full stay lifecycle, room move history, clean/dirty states, tax/invoice review and reconciled reports; no fabricated analytics                                                                                  |
| S4 — Distribution                             | S1B/S2; OTA mapping; event outbox/dedupe/retries/DLQ; versioned integration contracts                                                      | Each provider approval + sandbox certification; out-of-order/duplicate/cancel tests; outage alert/replay/reconciliation; no unauthorized live connectivity                                                            |
| S5 — Commercial intelligence and guest growth | Reliable S2–S4 data, licensed market sources, consent and partner approvals                                                                | Accurate/backtested forecasts, guardrails, Google feed parity, opt-out/consent tests and loyalty/attribution reconciliation                                                                                           |
| S6 — Expansion and enterprise                 | Stabilized operations/finance/integration contracts; resource scheduling; chain access and localization                                    | Separate UAT per module; folio/ledger reconciliation; AI evaluation/human handoff; privacy/legal/hardware/provider sign-off where applicable                                                                          |

No stage activates a module automatically. Code review, test/security evidence, operational integrations, tenant/plan grants and explicit release approval are required for each individual module. Owner roles below are engineering responsibilities, not invented people or assignment to external parties.

## All 39 modules

Full module-specific acceptance criteria are in `module-roadmap.json`. Requirements, priorities, audit status, external blockers and requirement-level acceptance are in `requirements-register.json`.

| #   | Approved module      | First stage | Depends on                                                         | Release     |
| --- | -------------------- | ----------- | ------------------------------------------------------------------ | ----------- |
| 1   | Dashboard            | S1A         | Existing foundation                                                | Coming Soon |
| 2   | Property Setup       | S1B         | foundation-identity                                                | Coming Soon |
| 3   | Staff & Roles        | S1A         | foundation-tenancy                                                 | Coming Soon |
| 4   | Reports & Analytics  | S3          | pms-front-desk, accounting-gst                                     | Coming Soon |
| 5   | Booking Engine       | S2          | inventory-management, rate-management, property-setup              | Coming Soon |
| 6   | PMS & Front Desk     | S2          | inventory-management, rate-management                              | Coming Soon |
| 7   | Central Reservations | S2          | pms-front-desk                                                     | Coming Soon |
| 8   | Group Bookings       | S2          | inventory-management, pms-front-desk                               | Coming Soon |
| 9   | Guest CRM            | S2          | pms-front-desk                                                     | Coming Soon |
| 10  | Inventory Management | S1B         | property-setup, staff-roles                                        | Coming Soon |
| 11  | Channel Manager      | S4          | inventory-management, rate-management, pms-front-desk, ota-mapping | Coming Soon |
| 12  | OTA Mapping          | S4          | property-setup, inventory-management, rate-management              | Coming Soon |
| 13  | Revenue Management   | S5          | reports-analytics, rate-management                                 | Coming Soon |
| 14  | Rate Shopping        | S5          | integrations-api                                                   | Coming Soon |
| 15  | Rate Management      | S1B         | inventory-management, property-setup                               | Coming Soon |
| 16  | Dynamic Pricing      | S5          | revenue-management, rate-management                                | Coming Soon |
| 17  | Google Hotel Ads     | S5          | booking-engine, rate-management                                    | Coming Soon |
| 18  | GDS & Wholesalers    | S4          | channel-manager                                                    | Coming Soon |
| 19  | Housekeeping         | S3          | pms-front-desk                                                     | Coming Soon |
| 20  | Maintenance          | S3          | inventory-management                                               | Coming Soon |
| 21  | Restaurant POS       | S6          | payments-refunds, accounting-gst                                   | Coming Soon |
| 22  | Resort Activities    | S6          | inventory-management, payments-refunds                             | Coming Soon |
| 23  | Events & Banquets    | S6          | group-bookings, payments-refunds                                   | Coming Soon |
| 24  | QR Guest Services    | S3          | guest-crm, pms-front-desk                                          | Coming Soon |
| 25  | Payments & Refunds   | S2          | inventory-management, pms-front-desk                               | Coming Soon |
| 26  | Accounting & GST     | S3          | payments-refunds, pms-front-desk                                   | Coming Soon |
| 27  | OTA Reconciliation   | S4          | channel-manager, payments-refunds                                  | Coming Soon |
| 28  | Corporate Ledger     | S6          | accounting-gst                                                     | Coming Soon |
| 29  | WhatsApp & Messaging | S5          | guest-crm, integrations-api                                        | Coming Soon |
| 30  | WhatsApp Automation  | S5          | whatsapp-messaging                                                 | Coming Soon |
| 31  | AI & Automation      | S6          | integrations-api, reports-analytics                                | Coming Soon |
| 32  | AI Chatbot           | S6          | guest-crm, integrations-api                                        | Coming Soon |
| 33  | Loyalty & Promotions | S5          | guest-crm, rate-management                                         | Coming Soon |
| 34  | Marketing & Reviews  | S5          | guest-crm, booking-engine                                          | Coming Soon |
| 35  | Multi-property       | S6          | property-setup, staff-roles, reports-analytics                     | Coming Soon |
| 36  | Integrations & API   | S4          | foundation-security                                                | Coming Soon |
| 37  | Security & Audit     | S1A         | Existing foundation                                                | Coming Soon |
| 38  | Subscription Billing | S6          | payments-refunds, security-audit                                   | Coming Soon |
| 39  | Settings             | S1A         | Existing foundation                                                | Coming Soon |

## Decisions needed before S1B/S2

Confirm pilot room types, physical units, pooled inventory vs beds/facilities, property timezone/currency, occupancy/child rules, cancellation/deposit policies, effective tax rules and business date. Define allowed hold TTL, authorized overbooking policy, rate precedence and resource conflict rules. Choose a PSP only when needed and document settlement/refund contracts. Confirm production region, expected property/room scale, budget, recovery targets and legal data-retention requirements. None is silently assumed in this readiness slice.

Booking lifecycle design remains SEARCH → QUOTE → HOLD → PAYMENT INTENT (if required) → VERIFIED PROVIDER EVENT → CONFIRM/INVENTORY COMMIT → OUTBOX → CHANNEL RECONCILIATION. Separate reservation, payment and sync states; immutable booking source, audit transitions and pending-reconciliation for uncertainty.
