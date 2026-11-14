CODEX MASTER PROMPT — STAYPUNCH360

Project Information

Product: StayPunch360
Domain: https://staypunch360.com
GitHub Repository: "pradeep5849/Staypunch"
Existing Framework: Next.js + TypeScript
Project: Hotel, Resort, Homestay and Multi-Property Management SaaS

Objective

Develop the complete initial StayPunch360 platform consisting of three professionally designed interfaces:

1. Super Admin Dashboard — "admin.staypunch360.com"
2. Public Marketing Website — "www.staypunch360.com"
3. Hotel Customer Dashboard — "app.staypunch360.com"

All three must use one shared backend architecture, authentication system, database and design system.

This is the initial platform foundation. Do not attempt to implement the entire PMS or Channel Manager in this task.

All planned modules must be visible with Coming Soon status until fully developed, tested and released.

1. Repository and Development Rules

- Inspect the existing repository before modifying anything.
- Preserve existing code and functionality.
- Read existing documentation and feature-release controls.
- Use the existing Next.js architecture where appropriate.
- Use PostgreSQL for the database.
- Implement secure authentication and role-based access control.
- Use environment variables for credentials.
- Never hardcode secrets, passwords or API keys.
- Keep the code modular, reusable and scalable.
- Build responsive desktop, tablet and mobile interfaces.
- Use a consistent premium SaaS design system.
- Do not introduce unnecessary paid services.

Use the following development workflow:

1. Create a new feature branch from the latest "main".
2. Implement the changes.
3. Run type checking, linting, tests and production build.
4. Fix all failures.
5. Create a pull request.
6. Review the implementation and report the validation results.
7. Do not merge until explicitly approved.

8. Public Website

Domain: "www.staypunch360.com"

Create a premium, modern hospitality SaaS marketing website.

Required pages:

- Home
- Features
- Channel Manager
- Property Management System
- Booking Engine
- Revenue Management
- Hotel Operations
- Integrations
- Pricing
- About Us
- Contact Us
- Request Demo
- Free Trial Registration
- Login
- FAQ
- Blog
- Privacy Policy
- Terms and Conditions

Homepage

Include:

- Premium hero section
- Product introduction
- Interactive dashboard preview
- Key features
- Benefits for hotels and resorts
- OTA connectivity information
- Product screenshots or clearly labeled mockups
- Pricing overview
- Demo request form
- Frequently asked questions
- Contact and footer

Use a professional design comparable in quality to leading hospitality SaaS websites.

Do not copy competitor branding, proprietary artwork or website layouts.

Feature Presentation

Display all modules planned for StayPunch360.

Modules not yet released must show Coming Soon.

Do not advertise unfinished features as currently available.

Pricing

Create the following configurable subscription tiers:

- Starter
- Premium
- Enterprise

Do not invent final subscription prices.

Prices and plan features must be manageable through Super Admin.

Lead Management

Implement demo requests, contact enquiries and trial registrations with database persistence, validation and spam protection.

Super Admin must be able to view and manage these enquiries.

3. Super Admin Dashboard

Domain: "admin.staypunch360.com"

Create a secure platform-owner dashboard.

Required Modules

Dashboard

- Total properties
- Active subscriptions
- Trial accounts
- Pending approvals
- Revenue overview
- Support requests
- Platform activity

Hotel Management

- List registered properties
- View property profiles
- Approve or reject registrations
- Activate and suspend accounts
- Manage property status
- Search and filter properties

Customer Management

- Customer profiles
- Account status
- Contact information
- Subscription details
- Activity history

Subscription Management

- Create and edit plans
- Configure plan features
- Manage trial periods
- Assign subscriptions
- Monitor renewals
- Track subscription status

Module Management

- List every StayPunch360 module
- Set development/release status
- Configure module availability by plan
- Configure property-specific entitlements
- Prevent unreleased features from becoming operational

Lead Management

- Demo requests
- Contact enquiries
- Trial requests
- Lead status
- Internal notes
- Follow-up assignment

OTA Integration Management

- Integration catalogue
- Provider configuration structure
- Property connection status
- Synchronization monitoring interface
- Error reporting structure

Real OTA connections must remain disabled until approved integrations are implemented.

Support Management

- Support tickets
- Ticket status
- Priority
- Assignment
- Customer communication history

Platform Settings

- Company information
- Branding
- Email configuration
- Subscription settings
- Security settings
- Audit logs
- Staff roles and permissions

Analytics

- Customer growth
- Trial conversions
- Subscription performance
- Platform revenue
- Feature adoption

Do not show fabricated business metrics as real data.

4. Hotel Customer Dashboard

Domain: "app.staypunch360.com"

Create a premium hotel management dashboard.

Initial Functional Features

- Secure login and logout
- Property registration and onboarding
- Property profile management
- Basic room-type configuration
- Property amenities
- Property contact details
- Staff invitation and role structure
- Subscription overview
- Module navigation
- Account settings

Planned Modules

Show the complete planned module catalogue, including:

- Booking Engine
- PMS and Front Desk
- Channel Manager
- Central Reservations
- Inventory Management
- Rate Management
- Revenue Management
- Dynamic Pricing
- Housekeeping
- Maintenance
- Restaurant POS
- Accounting and GST
- Payments and Refunds
- Guest CRM
- WhatsApp Automation
- AI Chatbot
- QR Guest Services
- Google Hotel Ads
- GDS and Wholesale Distribution
- OTA Mapping and Reconciliation
- Reports and Analytics
- Group Bookings
- Events and Banquets
- Resort Activities
- Loyalty and Promotions
- Multi-Property Management
- Integrations and API

Preserve every additional module already defined in the existing project documentation.

All unfinished modules must display Coming Soon.

5. Coming Soon → Live System

Create a centralized module registry.

Each module must support:

- Unique module ID
- Module name
- Description
- Category
- Development status
- Release status
- Subscription entitlement
- Property-level availability
- Required permissions

Suggested release states:

- Planned
- In Development
- Testing
- Released
- Disabled

Critical Rules

A module becomes Live only when:

1. Development is complete.
2. Required tests pass.
3. Security checks pass.
4. Required integrations are operational.
5. The release is approved.
6. The module is enabled for the relevant subscription and property.

A Super Admin toggle must not bypass technical release approval.

Enforce release permissions on the server, not only in the frontend.

Unfinished booking, payment and OTA functions must never execute real transactions.

6. Database Architecture

Design PostgreSQL tables for:

- Platform users
- Authentication identities
- Roles and permissions
- Organizations
- Properties
- Property memberships
- Room types
- Rooms
- Amenities
- Subscription plans
- Subscriptions
- Feature registry
- Feature entitlements
- Leads and demo requests
- Support tickets
- OTA provider registry
- Integration connections
- Audit logs
- Platform settings

Include:

- Primary and foreign keys
- Database constraints
- Tenant isolation
- Indexes
- Migration scripts
- Data validation
- Appropriate audit timestamps

Design the schema so future booking, inventory, payment and channel management modules can be added without major restructuring.

7. Security

Implement:

- Secure authentication
- Super Admin access isolation
- Hotel account isolation
- Role-based authorization
- Server-side permission checks
- Secure sessions
- Login rate limiting
- Input validation
- Audit logging
- Sensitive-data protection
- Password reset workflows
- Two-factor authentication architecture

Never expose Super Admin functionality through customer permissions.

Avoid hardcoded administrative credentials.

Provide a secure initial Super Admin bootstrap procedure.

8. UI/UX Requirements

Use a premium, modern and professional SaaS appearance.

Design requirements:

- Clean navigation
- Responsive sidebar
- Dashboard cards
- Search and filtering
- Data tables
- Forms and validation
- Loading states
- Empty states
- Error handling
- Toast notifications
- Accessible controls
- Mobile-friendly navigation
- Consistent typography and spacing

Use a shared component library across all three interfaces.

The Super Admin and Hotel Dashboard should have distinct navigation and permissions.

9. Domain and Deployment Architecture

Prepare the application for:

- "staypunch360.com"
- "www.staypunch360.com"
- "admin.staypunch360.com"
- "app.staypunch360.com"
- "book.staypunch360.com"
- "api.staypunch360.com"

Only the first three interfaces need complete UI implementation now.

Prepare the other subdomains for future development.

Do not change production DNS or deploy without explicit approval.

Document Hostinger deployment requirements, environment variables and database configuration.

10. Testing and Acceptance Criteria

Implement automated tests for:

- Authentication
- Authorization
- Tenant isolation
- Property registration
- Lead submission
- Subscription permissions
- Feature-release enforcement
- Super Admin access
- Hotel dashboard access
- Public website navigation

Run:

- TypeScript checks
- Linting
- Unit tests
- Integration tests
- Production build

Test responsive layouts and accessibility where tooling permits.

Do not claim tests passed unless they actually ran successfully.

11. Deliverables

Provide:

1. Complete public website implementation.
2. Complete initial Super Admin interface.
3. Hotel Dashboard foundation.
4. PostgreSQL migrations.
5. Secure authentication and authorization.
6. Centralized feature-release system.
7. Responsive shared design system.
8. Automated validation workflows.
9. Environment variable example file.
10. Deployment instructions.
11. Architecture documentation.
12. Updated requirements and development status documentation.
13. Pull request with implementation summary.

Clearly distinguish implemented features from placeholders.

12. Final Instructions

First inspect the repository and existing master documentation.

Do not remove previously agreed features.

Do not invent real hotel data, customer metrics, OTA connectivity or completed functionality.

Use clearly identified demo data only when needed for interface previews.

Prioritize working functionality over decorative mockups.

If an external service or credential is required, implement the safe integration boundary and document the configuration needed.

Do not block unrelated development because an optional external integration is unavailable.

Keep all unreleased features safely disabled.

Complete the implementation, validate it, fix errors and open a pull request. Do not merge without approval.

The goal is to establish a scalable, secure, premium StayPunch360 foundation that supports every planned module without rebuilding the platform later.
