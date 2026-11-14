# Security architecture

## Implemented controls

- bcrypt password hashing with cost 12, 12 character minimum and 72 byte maximum on new secrets.
- Cryptographically random 256-bit session, invitation and reset tokens; only SHA-256 hashes are persisted in their lookup tables.
- HttpOnly, SameSite=Lax cookies; Secure in production; host-only scope; seven-day session expiry. No broad domain cookie shares customer sessions with admin hosts.
- Password reset tokens expire after 30 minutes, are consumed atomically and revoke every existing session. Invitations expire after three days and require an exact account email match.
- Login/account endpoint throttling persists counters separately from the attempted action, so failed attempts cannot roll back the limit. Public leads are limited per normalized email, with schema validation and a honeypot. Arbitrary client IP headers are not trusted.
- Exact Origin checks on state-changing account and management requests, parameterized SQL, server-only database credentials, bounded fields, and role checks before data access.
- Super Admin isolation, property membership/permission checks, property suspension checks and tenant RLS under a non-owner role.
- Append-only runtime audit privileges. Admin bootstrap is operator-only and never silently promotes an existing account.
- Security response headers, frame denial, referrer controls and CSP. The current CSP permits inline scripts/styles for Next rendering; a nonce-based policy is future hardening.

## Deployment responsibilities

Use TLS, encrypted database backups, a trusted reverse proxy and request-body limits (recommended 64 KB on these JSON APIs). Add trusted edge throttling/challenges to protect against distributed spam using rotating emails; application throttling is not a replacement for network-level protection. Do not turn on public signups without email delivery and the final privacy/terms review. Keep database connections internal or enforce verified TLS. Redact credentials and session tokens from all reverse-proxy logs. Restrict access to the outbox because undelivered email bodies contain short-lived bearer links.

Delete expired sessions, auth tokens, invitations and rate counters on a schedule. Retain audit and lead records according to an approved retention policy. Take tested backups before schema changes. The application database role is trusted server infrastructure: never distribute its credential to customers or analytics clients. It must not own tables, have BYPASSRLS or be superuser. Do not give the web process the migration owner URL. MFA tables are reserved and must remain inaccessible to the current runtime role.

## Two-factor authentication: architecture only

`auth_factors` reserves TOTP secrets as encrypted bytes with key version and verification timestamp. `auth_challenges` stores hashed, expiring challenges and a maximum attempt count. `recovery_codes` stores one-way code hashes with consumption time. No enrollment, challenge verification, bypass or “MFA enabled” UI is shipped.

Before release: choose a maintained TOTP library; keep envelope-encryption keys in a vault outside PostgreSQL; require recent password reauthentication for enrollment/removal; implement replay prevention and atomic recovery-code consumption; create only a limited challenge cookie after password verification; issue the full session only after factor success; add security notifications and audited recovery. Test clock drift, replay, brute force, enrollment, reset and recovery before requiring MFA for platform staff. This architecture does not claim that administrators currently have MFA protection.

## Review boundaries

Automated authorization, RLS, CSRF, password reset, invitation and release-gate tests are part of CI. They are not a third-party penetration test. Email adapter, production TLS, edge policy, retention and secrets are deployment configuration that must be verified in the real environment.
