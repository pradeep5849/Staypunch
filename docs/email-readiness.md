# Email provider and account boundaries

The application does not assume successful delivery. Templates and queue producers are separate from the provider and worker. Production email configuration is intentionally deferred.

| Responsibility            | Implemented behavior                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Account verification      | Registration queues a 24-hour single-use hashed token; authenticated resend derives the recipient from the signed-in account; confirmation consumes the token atomically |
| Password reset            | Existing 30-minute token/session-revocation workflow preserved; shared template plus security notification                                                               |
| Staff invitation          | Email-bound invitation and three-day expiry preserved; acceptance attests the invited email; unverified owners cannot send invitations                                   |
| Account notifications     | Password-change and session-revocation messages queue through the same interface                                                                                         |
| Booking confirmation      | Template/interface readiness only; no booking event producer or operational sender is enabled                                                                            |
| Cancellation notification | Template/interface readiness only; no reservation/cancellation handler is enabled                                                                                        |

Existing accounts remain unverified until proof is supplied; there is no blanket verification backfill. Unverified users can sign in and configure their property/rooms. Staff invitations and any future operational module access require a verified address. Operator admin provisioning remains separate; MFA is still architecture only. GET verification links do not consume tokens, so email link scanners cannot confirm them accidentally.

## Provider contract

`EmailProvider.send` receives a stable queue ID, destination, subject and text. Production selection uses only the explicitly configured HTTPS webhook adapter; redirects and URL credentials are rejected. The adapter receives an `Idempotency-Key` equal to the queue ID. It must deduplicate retries and return JSON `{ "accepted": true, "receipt": "provider-reference" }` after accepting responsibility for sending. A generic 200/`ok` response is insufficient. No response body or bearer link is copied into failure logs.

An accepted receipt marks the queue row `sent` and redacts sensitive body content. **Sent means accepted by the configured provider, not confirmed mailbox delivery.** Delivery/bounce callbacks and notifications are later integration work. The in-memory `TestEmailProvider` reports `simulated`; the worker records that state separately and never selects it in the production CLI.

The worker locks one ready message with `FOR UPDATE SKIP LOCKED`, increments attempts and commits a durable outcome. Transient/429/408 failures back off from 30 seconds, doubling up to a one-hour cap. Five attempts or a permanent rejection move the row to `failed` (dead-letter state). Repeated runs skip terminal rows. Upstream acceptance followed by a database failure can still replay the same ID: real adapters must honor the idempotency key. Operators must investigate failed rows; this stage does not add an unaudited replay endpoint.

## Configuration later

Provision the restricted `stay_mailer` SQL role and apply `db/email-worker-grants.sql`. Set only `EMAIL_DATABASE_URL`, verified TLS settings, `EMAIL_DELIVERY_WEBHOOK` and `EMAIL_DELIVERY_TOKEN` in its scheduler process. `npm run email:deliver` processes at most 50 eligible rows, including eligible retries. It refuses to start without provider configuration and never falls back to console/file delivery. No migration-owner credential is needed.

Undelivered/failed bodies contain short-lived bearer links and must remain private with a defined retention/cleanup policy. The runtime may insert selected outbox columns but cannot read the queue or mark a message sent. The mailer cannot read user/session/MFA tables or modify accounts. Before public use, test actual verification/reset/invitation receipt, provider deduplication, bounce behavior, sender/domain authentication and the schedule using a real mailbox. No production SMTP credentials are needed for automated local tests.
