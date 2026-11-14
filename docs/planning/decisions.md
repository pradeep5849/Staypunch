# Stage S1A architecture decisions

| Decision                 | Choice and reason                                                                                                   | Status / limits                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Application structure    | Preserve the Next.js modular monolith and existing three interfaces                                                 | No rewrite or new paid dependency                                                    |
| Authentication           | Keep custom bcrypt/session/token auth; add verification and session controls                                        | Supabase Auth not introduced; MFA/device controls remain incomplete                  |
| Database                 | Standard PostgreSQL initially hosted on Supabase, later portable to Hostinger VPS                                   | Real project, region, costs and credentials configured later                         |
| Hosting                  | Owner-selected Hostinger Business target; confirm actual Node/runtime support before deployment                     | No account changes or hosting verification performed                                 |
| Data access              | Server-only pg connections; restricted app/mailer roles; actor-scoped tenant RLS; private privileged helpers        | Data API should be disabled; actual hosted settings/advisors still required          |
| Email                    | Transactional PostgreSQL outbox, provider interface and HTTPS receipt/idempotency contract                          | Real provider chosen/configured later; test transport explicitly simulated           |
| Recovery                 | Tested logical backup/restore for local foundation; documented Supabase/VPS procedures                              | Production PITR, retention, RPO/RTO and restore approval unresolved                  |
| Operational integrations | No PSP, OTA, Google, GDS, WhatsApp or AI provider chosen or enabled in this slice                                   | Partner access, privacy/tax review, costs and sandbox proof required in owning stage |
| Inventory/rates          | Next slice must distinguish pools/units/beds/resources and use append-only movements, holds and deterministic rates | No canonical ledger/rate plan/reservation implementation or pilot data invented here |

The source PDF's competitor/provider statements are reference material, not current commercial-access evidence. Recheck official availability and contracts when the relevant provider stage starts. Farmers Son Resort remains a pilot target only; no changes to farmerssonresort.com are authorized in this stage.
