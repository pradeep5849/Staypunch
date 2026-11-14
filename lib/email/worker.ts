import type { Pool } from "pg";
import { DeliveryError, type EmailProvider } from "./provider";
export async function deliverOne(pool: Pool, provider: EmailProvider) {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const mail = (
      await db.query(
        "SELECT id,recipient,subject,body,attempts FROM email_outbox WHERE status='queued' AND next_attempt_at<=now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1",
      )
    ).rows[0];
    if (!mail) {
      await db.query("COMMIT");
      return false;
    }
    const attempts = mail.attempts + 1;
    try {
      const result = await provider.send({
        id: mail.id,
        to: mail.recipient,
        subject: mail.subject,
        text: mail.body,
      });
      await db.query(
        "UPDATE email_outbox SET status=$1,attempts=$2,provider_receipt=$3,last_error_code=NULL,body='[message processed; sensitive content redacted]' WHERE id=$4",
        [
          result.outcome === "simulated" ? "simulated" : "sent",
          attempts,
          result.receipt,
          mail.id,
        ],
      );
    } catch (e) {
      const failure =
        e instanceof DeliveryError ? e : new DeliveryError("PROVIDER_FAILURE");
      const terminal = failure.permanent || attempts >= 5;
      await db.query(
        "UPDATE email_outbox SET attempts=$1,status=$2,last_error_code=$3,next_attempt_at=now()+($4*interval '1 second') WHERE id=$5",
        [
          attempts,
          terminal ? "failed" : "queued",
          failure.code,
          Math.min(3600, 30 * 2 ** (attempts - 1)),
          mail.id,
        ],
      );
    }
    await db.query("COMMIT");
    return true;
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  } finally {
    db.release();
  }
}
