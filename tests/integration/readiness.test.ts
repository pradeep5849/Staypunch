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
