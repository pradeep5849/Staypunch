import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { deliverOne } from "../../lib/email/worker";
import {
  DeliveryError,
  TestEmailProvider,
  type EmailProvider,
} from "../../lib/email/provider";
assert.ok(
  process.env.TEST_DATABASE_OWNER_URL &&
    process.env.TEST_DATABASE_URL &&
    process.env.TEST_EMAIL_DATABASE_URL,
  "Explicit disposable database connections required",
);
const owner = new Pool({
  connectionString: process.env.TEST_DATABASE_OWNER_URL,
});
const app = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const mailer = new Pool({
  connectionString: process.env.TEST_EMAIL_DATABASE_URL,
});
after(async () => {
  await owner.end();
  await app.end();
  await mailer.end();
});
test("all app tables have RLS and hosted API roles cannot read private data or invoke helpers", async () => {
  assert.equal(
    (
      await owner.query(
        "SELECT count(*) total FROM pg_tables WHERE schemaname='public' AND NOT rowsecurity",
      )
    ).rows[0].total,
    "0",
  );
  for (const role of ["anon", "authenticated", "service_role"]) {
    const db = await owner.connect();
    try {
      await db.query("BEGIN");
      await db.query(`SET LOCAL ROLE ${role}`);
      await assert.rejects(
        db.query("SELECT * FROM users"),
        /permission denied/,
      );
      await db.query("ROLLBACK");
      await db.query("BEGIN");
      await db.query(`SET LOCAL ROLE ${role}`);
      await assert.rejects(
        db.query("SELECT stay_private.is_platform_admin()"),
        /permission denied/,
      );
      await db.query("ROLLBACK");
    } finally {
      db.release();
    }
  }
});
test("runtime cannot assign platform roles or read outbox/MFA; mailer cannot read identities", async () => {
  await assert.rejects(
    app.query(
      "INSERT INTO users(email,name,password_hash,platform_role) VALUES('forbidden@example.test','Forbidden','not-a-real-password','super_admin')",
    ),
    /permission denied/,
  );
  await assert.rejects(
    app.query("SELECT * FROM email_outbox"),
    /permission denied/,
  );
  await assert.rejects(
    app.query("SELECT * FROM auth_factors"),
    /permission denied/,
  );
  await assert.rejects(
    mailer.query("SELECT * FROM users"),
    /permission denied/,
  );
});
test("pooled actor context is cleared after transaction completion", async () => {
  const db = await app.connect();
  try {
    await db.query("BEGIN");
    const id = randomUUID();
    await db.query("SELECT set_config('app.user_id',$1,true)", [id]);
    assert.equal((await db.query("SELECT current_actor() id")).rows[0].id, id);
    await db.query("COMMIT");
    assert.equal(
      (await db.query("SELECT current_actor() id")).rows[0].id,
      null,
    );
  } finally {
    db.release();
  }
});
async function queue() {
  await owner.query("TRUNCATE email_outbox");
  return (
    await owner.query(
      "INSERT INTO email_outbox(recipient,subject,body) VALUES('worker@example.test','Test only','Disposable secret token') RETURNING id",
    )
  ).rows[0].id;
}
test("simulated transport never becomes sent and processed content is redacted", async () => {
  const id = await queue();
  const provider = new TestEmailProvider();
  assert.equal(await deliverOne(mailer, provider), true);
  const row = (
    await owner.query("SELECT * FROM email_outbox WHERE id=$1", [id])
  ).rows[0];
  assert.equal(row.status, "simulated");
  assert.ok(!row.body.includes("Disposable"));
  assert.equal(provider.messages.size, 1);
  assert.equal(await deliverOne(mailer, provider), false);
});
test("transient failures back off, exhaust after five attempts, and preserve idempotency", async () => {
  const id = await queue();
  const seen: string[] = [];
  const failing: EmailProvider = {
    async send(m) {
      seen.push(m.id);
      throw new DeliveryError("TEST_TRANSIENT");
    },
  };
  for (let i = 1; i <= 5; i++) {
    await owner.query(
      "UPDATE email_outbox SET next_attempt_at=now() WHERE id=$1",
      [id],
    );
    await deliverOne(mailer, failing);
    const row = (
      await owner.query(
        "SELECT status,attempts,next_attempt_at>now() future FROM email_outbox WHERE id=$1",
        [id],
      )
    ).rows[0];
    assert.equal(row.attempts, i);
    assert.equal(row.status, i === 5 ? "failed" : "queued");
    assert.equal(row.future, true);
    assert.equal(await deliverOne(mailer, failing), false);
  }
  assert.deepEqual([...new Set(seen)], [id]);
});
test("permanent failures dead-letter immediately; concurrent workers process one message once", async () => {
  const id = await queue();
  await deliverOne(mailer, {
    async send() {
      throw new DeliveryError("TEST_PERMANENT", true);
    },
  });
  assert.equal(
    (await owner.query("SELECT status FROM email_outbox WHERE id=$1", [id]))
      .rows[0].status,
    "failed",
  );
  await queue();
  const provider = new TestEmailProvider();
  let calls = 0;
  const counted: EmailProvider = {
    async send(message) {
      calls++;
      return provider.send(message);
    },
  };
  await Promise.all([deliverOne(mailer, counted), deliverOne(mailer, counted)]);
  assert.equal(calls, 1);
  assert.equal(provider.messages.size, 1);
});

test("expired and legacy token emails and unreleased operational mail are withheld and redacted", async () => {
  for (const [kind, body, created, code] of [
    [
      "password_reset",
      "https://example.test/reset?token=synthetic",
      "31 minutes",
      "TOKEN_EXPIRED",
    ],
    [
      "verification",
      "https://example.test/verify?token=synthetic",
      "25 hours",
      "TOKEN_EXPIRED",
    ],
    [
      "staff_invitation",
      "https://example.test/invite?token=synthetic",
      "4 days",
      "TOKEN_EXPIRED",
    ],
    [
      "account_notification",
      "https://example.test/reset?token=synthetic",
      "1 minute",
      "LEGACY_TOKEN_METADATA_MISSING",
    ],
    ["booking_confirmation", "synthetic", "1 minute", "UNRELEASED_EMAIL_KIND"],
  ]) {
    const id = await queue();
    await owner.query(
      "UPDATE email_outbox SET kind=$1,body=$2,created_at=clock_timestamp()-$3::interval WHERE id=$4",
      [kind, body, created, id],
    );
    const provider = new TestEmailProvider();
    assert.equal(await deliverOne(mailer, provider), true);
    const row = (
      await owner.query(
        "SELECT status,body,last_error_code,last_attempt_at FROM email_outbox WHERE id=$1",
        [id],
      )
    ).rows[0];
    assert.equal(row.status, "failed");
    assert.equal(row.last_error_code, code);
    assert.equal(row.last_attempt_at, null);
    assert.ok(!row.body.includes("token="));
    assert.equal(provider.messages.size, 0);
  }
});
test("superseded reset links are not delivered while the latest queued link remains eligible", async () => {
  const old = await queue();
  await owner.query(
    "UPDATE email_outbox SET kind='password_reset',created_at=now()-interval '5 minutes' WHERE id=$1",
    [old],
  );
  const latest = (
    await owner.query(
      "INSERT INTO email_outbox(recipient,subject,body,kind) VALUES('worker@example.test','Reset','synthetic-new-link','password_reset') RETURNING id",
    )
  ).rows[0].id;
  const provider = new TestEmailProvider();
  await deliverOne(mailer, provider);
  assert.equal(provider.messages.size, 0);
  assert.equal(
    (
      await owner.query(
        "SELECT last_error_code FROM email_outbox WHERE id=$1",
        [old],
      )
    ).rows[0].last_error_code,
    "TOKEN_SUPERSEDED",
  );
  await deliverOne(mailer, provider);
  assert.ok(provider.messages.has(latest));
});
test("SMTP attempt limits persist across mailer instances and concurrent workers", async () => {
  await queue();
  await owner.query(
    "INSERT INTO email_outbox(recipient,subject,body) VALUES('second@example.test','Test','synthetic')",
  );
  const second = new Pool({
    connectionString: process.env.TEST_EMAIL_DATABASE_URL,
  });
  const provider = new TestEmailProvider();
  try {
    await Promise.all([
      deliverOne(mailer, provider, 1),
      deliverOne(second, provider, 1),
    ]);
    assert.equal(provider.messages.size, 1);
    assert.equal(await deliverOne(second, provider, 1), false);
    assert.equal(
      (
        await owner.query(
          "SELECT count(*) AS n FROM email_outbox WHERE last_attempt_at IS NOT NULL",
        )
      ).rows[0].n,
      "1",
    );
    await owner.query(
      "UPDATE email_outbox SET last_attempt_at=now()-interval '61 seconds' WHERE last_attempt_at IS NOT NULL",
    );
    assert.equal(await deliverOne(second, provider, 1), true);
    assert.equal(provider.messages.size, 2);
  } finally {
    await second.end();
  }
});
test("global SMTP configuration failures stop the batch without attempting subsequent rows", async () => {
  await queue();
  await owner.query(
    "INSERT INTO email_outbox(recipient,subject,body) VALUES('second@example.test','Test','synthetic')",
  );
  await assert.rejects(
    deliverOne(mailer, {
      async send() {
        throw new DeliveryError("SMTP_AUTH", false, true);
      },
    }),
    (error) => error instanceof DeliveryError && error.haltBatch,
  );
  assert.equal(
    (await owner.query("SELECT sum(attempts) AS n FROM email_outbox")).rows[0]
      .n,
    "1",
  );
  assert.equal(
    (
      await owner.query(
        "SELECT count(*) AS n FROM email_outbox WHERE attempts=0",
      )
    ).rows[0].n,
    "1",
  );
});

test("queued rows that already exhausted attempts cannot be sent again", async () => {
  const id = await queue();
  await owner.query("UPDATE email_outbox SET attempts=5 WHERE id=$1", [id]);
  const provider = new TestEmailProvider();
  await deliverOne(mailer, provider);
  assert.equal(provider.messages.size, 0);
  const row = (
    await owner.query(
      "SELECT status,last_error_code FROM email_outbox WHERE id=$1",
      [id],
    )
  ).rows[0];
  assert.equal(row.status, "failed");
  assert.equal(row.last_error_code, "RETRY_EXHAUSTED");
});

test("worker refuses migration-owner credentials before reading or sending queue contents", async () => {
  const id = await queue(),
    provider = new TestEmailProvider();
  await assert.rejects(
    deliverOne(owner, provider),
    /Restricted mailer role required/,
  );
  assert.equal(provider.messages.size, 0);
  const row = (
    await owner.query("SELECT status,attempts FROM email_outbox WHERE id=$1", [
      id,
    ])
  ).rows[0];
  assert.equal(row.status, "queued");
  assert.equal(row.attempts, 0);
});
