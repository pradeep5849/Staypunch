// A separately scheduled operator process. Never expose this queue via public APIs.
import { Pool } from "pg";
const url = process.env.EMAIL_DELIVERY_WEBHOOK;
const credential = process.env.EMAIL_DELIVERY_TOKEN;
if (!url || !credential || new URL(url).protocol !== "https:")
  throw new Error(
    "Configure an HTTPS email delivery adapter and its credential",
  );
if (!process.env.MIGRATION_DATABASE_URL)
  throw new Error("Operator database URL is required for the delivery worker");
const pool = new Pool({ connectionString: process.env.MIGRATION_DATABASE_URL });
const db = await pool.connect();
try {
  for (let i = 0; i < 50; i++) {
    await db.query("BEGIN");
    try {
      const mail = (
        await db.query(
          "SELECT * FROM email_outbox WHERE status='queued' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1",
        )
      ).rows[0];
      if (!mail) {
        await db.query("COMMIT");
        break;
      }
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credential}`,
          "Content-Type": "application/json",
          "Idempotency-Key": mail.id,
        },
        body: JSON.stringify({
          id: mail.id,
          to: mail.recipient,
          subject: mail.subject,
          text: mail.body,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error("Delivery adapter rejected email");
      await db.query(
        "UPDATE email_outbox SET status='sent',body='[delivered token redacted]' WHERE id=$1",
        [mail.id],
      );
      await db.query("COMMIT");
    } catch (e) {
      await db.query("ROLLBACK");
      throw e;
    }
  }
} finally {
  db.release();
  await pool.end();
}
