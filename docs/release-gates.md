# Coming Soon → Live

All planned modules default to Coming Soon. Property onboarding, accounts and admin foundation services are implemented separately; none imply a live PMS, booking engine or channel manager.

A module can run only when all of these hold:

1. Its source-controlled approval records completed development, passing functional/integration tests, security checks, operational integrations and release approval.
2. The database registry release state is `released`.
3. The property's subscription is active or an unexpired trial.
4. Both its plan entitlement and property entitlement are explicitly enabled.
5. The authenticated property member has the required permission and the property is not suspended/rejected.
6. A reviewed server transaction handler exists.

`lib/modules.ts` currently has an empty, frozen approval catalogue. Admin APIs accept planned/in-development/testing/disabled states, never `released`. An operator cannot safely replace the technical review with a database update: even an accidental `released` value plus all entitlements fails the source approval check. `/api/modules/:id` has no operational handler and fails closed.

Future release PRs must include technical evidence, tenant tests, reconciliation/rollback behavior where needed and a reviewed registry entry. A migration sets the database release state only after those checks and release approval. Add the real server handler only in that reviewed release. Keep frontend navigation aligned with the same effective release decision; a visual badge is never authorization.

Preserve the inventory authority requirement: future booking, PMS and channel operations must share one authoritative inventory transaction model. Real OTA credentials, transactions, payments or refunds must never be exercised by a Coming Soon preview.
