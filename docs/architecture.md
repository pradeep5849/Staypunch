# Shared platform architecture

## Runtime and interfaces

One Next.js App Router application serves `/` (marketing), `/admin` (platform owner), and `/app` (hotel team). Shared UI primitives and CSS tokens provide an olive, forest and ivory hospitality design. Public pages include all requested marketing, legal draft, enquiry, pricing and login routes. The home preview is explicitly illustrative and has no business metrics. Host-based proxy rewrites prepare the app and admin subdomains; path routes remain available for development. `book` and `api` hosts return 503 until a future reviewed release.

The server owns authentication and authorization. Route handlers validate Zod schemas, perform parameterized PostgreSQL queries in transactions, append audit events and return bounded errors. No database credentials reach browser code. PostgreSQL owns identity, organizations, properties, membership, catalogue, subscriptions, leads, support and audit state. There is no separate paid backend dependency.

## Tenant model

Users can belong to several properties through memberships. Each property belongs to an organization. A property owner can configure the property and invite staff. Managers configure property and room types; staff read the property and create/reply to support tickets. Platform administrators have a separate platform role and guarded `/admin` handlers. Platform role cannot be supplied through registration, invitations or property memberships.

The runtime database role is different from the migration owner. RLS checks the transaction-local authenticated actor on property-scoped tables. Services additionally enforce property status and role permission. `has_property_access` is a narrow SECURITY DEFINER function with a fixed search path to avoid RLS recursion. Invitation acceptance is another narrow SECURITY DEFINER function: it requires matching current actor, account email, unexpired token and single-use redemption. SQL credentials remain a trusted server boundary, never user credentials.

Room type/room composite foreign keys prevent attaching a room to another property's room type. There is no operational inventory state, booking state or money ledger in this release. Future PMS and channel adapters must use a shared authoritative inventory transaction model, preserving the original repository requirement.

## Module model

The source catalogue preserves the original modules and adds inventory, rate management, dynamic pricing, WhatsApp automation and AI chatbot. Migration tooling upserts names/descriptions without overwriting release state. The database holds development state, release state, plan grants and property grants. Source-controlled technical approval and runtime entitlement checks must all pass. There are no source approvals and no operational handlers. Admin configuration is explicitly not a release mechanism.

## Data and measurement

Dashboard totals and monthly customer registrations query real database records. Subscription states represent configured account access, not money collected. Revenue, conversion cohorts and operational adoption are explicitly unavailable. List pages currently cap at 100 records; pagination, materialized analytics and event-based conversion tracking are later scalability work. No synthetic business data is seeded. Automated tests create clearly named records in disposable test databases only.

## Email integration boundary

Reset and invitation workflows queue messages in `email_outbox`. `npm run email:deliver` is an operator-only worker calling a configured HTTPS delivery adapter. The adapter receives `id`, `to`, `subject` and `text`, and must enforce the idempotency key before accepting mail. Successful messages redact token text. Failed requests roll back and remain queued. Do not expose this queue in dashboards. Delivery is not enabled until the operator configures a real adapter and confirms successful delivery.
