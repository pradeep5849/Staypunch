# StayPunch360

A Next.js + TypeScript and PostgreSQL foundation for hotels, resorts and homestays. Public marketing, platform administration and property workspaces share one backend and component system.

## Local setup

1. Use Node 22+ and PostgreSQL 17+. Run `npm ci`.
2. Copy `.env.example` to `.env.local`. Next loads it automatically; CLI migration/bootstrap tools need variables exported by your shell or a secret manager.
3. Run `npm run migrate` using an operator-only `MIGRATION_DATABASE_URL`.
4. Create a separate `stay_app` login, supply its password securely, then run `db/runtime-grants.sql` as the owner. The example database name is `staypunch`; adapt its CONNECT grant for your deployment. Never use a superuser or table owner as the runtime role.
5. Set `DATABASE_URL` to that restricted role. Set `APP_URL` to the public customer origin.
6. Bootstrap a platform administrator with `BOOTSTRAP_ADMIN_EMAIL` and a unique 12–72 byte `BOOTSTRAP_ADMIN_PASSWORD`, then `npm run bootstrap:admin`. Remove bootstrap variables immediately afterward. Existing accounts are never promoted by this script.
7. Run `npm run dev`. Visit `/`, `/login`, `/register`, `/app`, and `/admin`.

The public website renders without a database, with unannounced pricing. Account features fail closed until PostgreSQL is configured. Password reset and invitations queue email; configure and run the delivery adapter before inviting real customers.

## Validate

```
npm run typecheck
npm run lint
npm test
npm run build
```

Database and browser suites require a disposable migrated database and the restricted runtime role. See [testing](docs/testing.md).

## Release boundaries

Every roadmap module remains Coming Soon. No booking, inventory transaction, payment, refund, billing collection or OTA synchronization handler exists. Property profiles, room type configuration and administration are foundation services, separate from planned PMS operations. Technical release approval cannot be enabled by an admin toggle.

- [Architecture](docs/architecture.md)
- [Security and MFA architecture](docs/security.md)
- [Release gates](docs/release-gates.md)
- [Deployment and Hostinger requirements](docs/deployment.md)
- [Requirements and development status](docs/status.md)

Production deployment, DNS changes and merging require explicit approval. This implementation does not perform them.
