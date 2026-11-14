StayPunch360 — Master Codex Development Instructions

1. Project Information

Project: StayPunch360
GitHub Repository: "pradeep5849/Staypunch"
Technology: Next.js, TypeScript, PostgreSQL
Hosting: Hostinger Business Web Hosting
Initial Database: Supabase PostgreSQL
Future Database: Hostinger VPS PostgreSQL
Approved Product Scope: 39 Modules

2. Primary Objective

Develop StayPunch360 into a complete, secure, scalable hospitality management SaaS platform, following the attached StayPunch360 Consolidated Master PDF.

Our goal is to build a competitive hospitality platform with booking management, PMS, channel management, revenue management, hotel operations, accounting, automation and related services.

The master PDF is the primary product reference.

Do not implement all 39 modules simultaneously.

First audit the existing repository, identify completed and missing functionality, establish the development roadmap, and implement the next incomplete stage.

3. Existing Development — Important

The project already contains a foundation developed and merged into the "main" branch.

Existing work includes:

- Public marketing website
- Super Admin interface
- Hotel Owner Dashboard foundation
- PostgreSQL database migrations
- Authentication and role-based permissions
- Multi-tenant architecture
- Row-level security foundation
- Module release gates
- GitHub Actions CI workflow
- Automated tests

Do not rebuild or overwrite completed functionality.

Inspect the actual implementation before deciding what is complete. A screen or database table alone does not mean a feature is operational.

4. Approved 39 Modules

Overview — 4

1. Dashboard
2. Property Setup
3. Staff & Roles
4. Reports & Analytics

Reservations — 6

5. Booking Engine
6. PMS & Front Desk
7. Central Reservations
8. Group Bookings
9. Guest CRM
10. Inventory Management

Distribution — 8

11. Channel Manager
12. OTA Mapping
13. Revenue Management
14. Rate Shopping
15. Rate Management
16. Dynamic Pricing
17. Google Hotel Ads
18. GDS & Wholesalers

Operations — 6

19. Housekeeping
20. Maintenance
21. Restaurant POS
22. Resort Activities
23. Events & Banquets
24. QR Guest Services

Finance — 4

25. Payments & Refunds
26. Accounting & GST
27. OTA Reconciliation
28. Corporate Ledger

Growth — 6

29. WhatsApp & Messaging
30. WhatsApp Automation
31. AI & Automation
32. AI Chatbot
33. Loyalty & Promotions
34. Marketing & Reviews

Platform — 5

35. Multi-property
36. Integrations & API
37. Security & Audit
38. Subscription Billing
39. Settings

These 39 modules are approved. Do not remove, rename, merge or add modules without approval.

Related modules may share backend services, but each must retain its defined responsibilities.

5. Database Strategy

Use Supabase PostgreSQL initially.

We will configure the actual Supabase project and production database credentials later.

Requirements:

1. Use standard PostgreSQL wherever practical.
2. Preserve the existing database migrations.
3. Maintain tenant isolation and row-level security.
4. Keep application authentication independent of Supabase Auth unless explicitly approved.
5. Use environment variables for database connections.
6. Never hardcode passwords, API keys or connection strings.
7. Do not commit ".env" files containing secrets.
8. Support local PostgreSQL for development and CI.
9. Design for future migration to Hostinger VPS PostgreSQL.
10. Document backup, restore and migration procedures.

Do not deploy or migrate production data without approval.

6. Email Configuration

Email service configuration will be completed later.

Prepare the application architecture for:

- Account verification
- Password reset
- Staff invitations
- Account notifications
- Booking confirmation emails
- Reservation cancellation notifications

Use a configurable email provider interface.

Do not assume that emails are successfully delivered until an actual provider is configured and tested.

Do not block development solely because production SMTP credentials are unavailable.

7. Application Structure

Maintain three distinct application areas.

Public Website

- Marketing pages
- Features and product information
- Pricing presentation when approved
- Registration and login entry points
- Contact and demonstration requests

Super Admin

- Platform administration
- Hotel and account management
- Subscription and plan management
- Module activation controls
- Security and audit monitoring
- Platform settings

Hotel Owner Dashboard

- Property management
- Staff and permissions
- Reservations and operations
- Reports
- Module-specific workspaces
- Property settings

Maintain proper authorization and separation between platform administrators, hotel owners and staff.

8. Module Activation Policy

All 39 modules must remain Coming Soon unless individually completed and approved.

A module may become Live only after:

1. Development is complete.
2. Automated tests pass.
3. Security validation passes.
4. Required integrations work.
5. Permissions and tenant isolation are verified.
6. Release approval is obtained.

Do not enable unfinished functionality through UI changes or bypass the existing release gates.

9. Development Roadmap

First create a dependency-based implementation roadmap.

Prioritize foundational capabilities before dependent operational modules.

Consider this suggested sequence, subject to the master PDF and repository audit:

Stage 1 — Foundation Completion

- Database integration readiness
- Authentication and account management
- Security and tenant isolation
- Super Admin functionality
- Property onboarding
- Staff and permissions
- Email integration readiness

Stage 2 — Core Booking System

- Property inventory
- Room types and availability
- Rate plans
- Booking Engine
- Reservations
- PMS and Front Desk

Stage 3 — Distribution

- Channel Manager architecture
- OTA mapping
- Rate and inventory synchronization
- Revenue management foundations

Stage 4 — Hotel Operations

- Housekeeping
- Maintenance
- Guest services
- Activities and POS

Stage 5 — Finance

- Payments
- Accounting and GST
- Reconciliation
- Ledgers

Stage 6 — Growth and Advanced Features

- CRM and marketing
- WhatsApp
- AI
- Loyalty
- Advanced revenue tools

Stage 7 — Enterprise and Platform Expansion

- Multi-property capabilities
- Advanced integrations
- Subscription billing
- Advanced security and analytics

Refine the roadmap based on actual dependencies and requirements. Do not treat this suggested sequence as overriding the master PDF.

10. Channel Manager Requirements

The future Channel Manager must support a scalable integration architecture for OTA platforms such as Booking.com, Expedia, Agoda and MakeMyTrip, subject to each provider's integration approval and API availability.

Plan for:

- Centralized room inventory
- Rate synchronization
- Reservation synchronization
- Availability updates
- Mapping between internal room types and OTA listings
- Duplicate reservation prevention
- Retry handling
- Idempotent processing
- Webhook and polling support where applicable
- Audit logs
- Error monitoring

Do not claim an OTA integration is live without real credentials, authorization and successful end-to-end testing.

11. Booking Engine Requirements

The Booking Engine should eventually support direct reservations from hotel websites.

Plan for:

- Hotel-specific booking pages
- Embeddable booking widget
- Room availability search
- Rates and offers
- Guest information
- Reservation creation
- Payment integration
- Confirmation notifications
- Cancellation and refund policies

The future booking engine should be capable of integration with "farmerssonresort.com".

Do not modify that website during the current stage.

12. Security Requirements

Maintain strong SaaS security practices:

- Tenant-level data isolation
- Role-based access control
- Secure sessions
- Password hashing
- Server-side authorization
- Input validation
- Rate limiting
- Audit logging
- Secure secret management
- Safe database migrations
- Protection against common web vulnerabilities

Do not weaken existing security controls to make tests pass.

13. GitHub Workflow — Mandatory

For every development stage:

1. Create a new feature branch from the latest "main".
2. Implement only the approved stage.
3. Add or update automated tests.
4. Run linting, type checking and build validation.
5. Run applicable unit, integration and end-to-end tests.
6. Open a GitHub Pull Request.
7. Wait for GitHub Actions CI results.
8. Fix failures and review findings.
9. Provide the PR link and implementation summary.
10. Do not merge until explicitly approved.

Never push unfinished features directly to "main".

Do not deploy or modify production DNS without approval.

14. Initial Task — Start Here

Before writing significant new code:

Step A — Repository Audit

Inspect the current "main" branch and compare the implementation against the master PDF.

Classify requirements as:

- Completed and tested
- Partially implemented
- Not implemented
- Blocked by external configuration
- Blocked by third-party approval

Step B — Gap Analysis

Identify missing functionality, security concerns, database dependencies, unfinished authentication features and infrastructure requirements.

Step C — Development Roadmap

Prepare a staged roadmap covering all 39 modules, including dependencies, milestones and acceptance criteria.

Step D — First Implementation

Begin only the first incomplete foundation stage that can be safely developed without production credentials.

Use local PostgreSQL and test email adapters where required.

Step E — Validation

Run all applicable tests and open a PR.

Do not merge.

15. Required Final Report

After completing the initial task, provide:

1. Repository audit summary
2. Existing functionality verified
3. Missing and incomplete requirements
4. Full 39-module implementation roadmap
5. First stage implemented
6. Database migration changes
7. Security findings
8. Automated test results
9. GitHub Actions CI status
10. Pull Request link
11. Configuration required from the owner
12. Recommended next development stage

Final Rules

- The attached Master PDF is the approved product reference.
- Keep all 39 modules in scope.
- Preserve existing working code.
- Avoid unnecessary rewrites.
- Never invent completed features.
- Never expose credentials.
- Do not require production Supabase or email configuration to begin local development.
- Never activate incomplete modules.
- Never merge or deploy without approval.

Begin with the repository audit, roadmap and first incomplete foundation stage.
