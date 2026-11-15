# Rotate the existing app database password

Use **Manual StayPunch360 app database password rotation** on reviewed `main`, with confirmation `ROTATE-STAYPUNCH-APP-PASSWORD`, only after explicit approval. Do not rerun the original role-provisioning workflow.

The protected `staypunch360-production` Environment supplies the existing migration URL, trusted CA and updated `STAYPUNCH_APP_DATABASE_PASSWORD`. The workflow does not receive the mailer password. It shares the production-database concurrency lock and never prints passwords, connection strings, SQL or raw driver errors.

The script requires an existing restricted `stay_app` login with no elevated flags, role memberships or object ownership. It changes only that role's password in a transaction and verifies unchanged role attributes and application ACLs before commit. It does not apply grant files, create roles, bootstrap accounts, modify users or write business records.

After commit it opens a fresh connection as `stay_app`, using the same direct/session endpoint with a safely encoded password, and checks the actual current role and restricted privileges. Remote connections retain CA and hostname verification. Bounded retries repeat fresh authentication only, never the password change. A verification failure after commit is reported explicitly; do not assume the old password remains active. A connection loss during COMMIT can leave the outcome uncertain, so inspect state before any retry.

## Hostinger coordination

Privately update Hostinger's restricted `DATABASE_URL` to the same app password: use `stay_app.<project-ref>` on the Supabase session pooler (5432), or `stay_app` on the project's direct endpoint. Encode the password as URL userinfo. Retain verified TLS and the trusted CA. GitHub secrets do not automatically update Hostinger.

Existing database connections are not terminated by the script. New web connections using the previous password can fail after rotation, so coordinate the hosting change. The connector masks existing hosting values and replaces the entire environment set when writing; never overwrite unknown values with masks.

After rotation and hosting configuration, run the protected deployed-admin browser check to verify Hostinger connectivity. Normal login/logout bookkeeping may be written by that check; Super Admin credentials and business records must remain unchanged.

## Validation

Unit tests cover URI encoding, exact project/session endpoint selection, password validation and workflow guards. A separate disposable PostgreSQL cluster exercises real rotation, new-password login, old-password rejection, unchanged mailer verifier, unchanged account/business rows and unchanged role attributes/ACLs. It never rotates the shared CI app role or any production credential.
