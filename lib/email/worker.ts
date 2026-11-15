import type { Pool } from "pg";
import { DeliveryError, type EmailProvider } from "./provider";
import { emailPolicy } from "./policy";
export async function deliverOne(
  pool: Pool,
  provider: EmailProvider,
  maxPerMinute = 5,
) {
  if (!Number.isInteger(maxPerMinute) || maxPerMinute < 1 || maxPerMinute > 30)
    throw new Error("Invalid email rate limit");
  const db = await pool.connect();
  let committed = false;
  try {
    await db.query("BEGIN");
    const role = (
      await db.query(
        "SELECT r.rolname,r.rolsuper,r.rolbypassrls,r.rolcreatedb,r.rolcreaterole,r.rolreplication,(SELECT count(*)::integer FROM pg_auth_members m WHERE m.member=r.oid) AS memberships,EXISTS(SELECT 1 FROM pg_class c WHERE c.relowner=r.oid) AS owns_relations,EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspowner=r.oid) AS owns_schemas,EXISTS(SELECT 1 FROM pg_database d WHERE d.datdba=r.oid) AS owns_databases FROM pg_roles r WHERE rolname=current_user",
      )
    ).rows[0];
    if (
      role?.rolname !== "stay_mailer" ||
      role.rolsuper ||
      role.rolbypassrls ||
      role.rolcreatedb ||
      role.rolcreaterole ||
      role.rolreplication ||
      role.memberships ||
      role.owns_relations ||
      role.owns_schemas ||
      role.owns_databases
    )
      throw new Error("Restricted mailer role required");
    // Serializes the shared minute window across processes, not just one Node instance.
    await db.query("SELECT pg_advisory_xact_lock(360465)");
    const mail = (
      await db.query(
        "SELECT id,recipient,subject,body,kind,created_at,attempts,clock_timestamp() AS checked_at FROM email_outbox WHERE status='queued' AND next_attempt_at<=clock_timestamp() ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1",
      )
    ).rows[0];
    if (!mail) {
      await db.query("COMMIT");
      committed = true;
      return false;
    }
    let rejected =
      mail.attempts >= 5
        ? "RETRY_EXHAUSTED"
        : emailPolicy(mail, mail.checked_at);
    if (!rejected && ["verification", "password_reset"].includes(mail.kind)) {
      const newer = await db.query(
        "SELECT 1 FROM email_outbox WHERE recipient=$1 AND kind=$2 AND created_at>(SELECT created_at FROM email_outbox WHERE id=$3) LIMIT 1",
        [mail.recipient, mail.kind, mail.id],
      );
      if (newer.rowCount) rejected = "TOKEN_SUPERSEDED";
    }
    if (rejected) {
      await db.query(
        "UPDATE email_outbox SET status='failed',last_error_code=$1,body='[message withheld; sensitive content redacted]' WHERE id=$2",
        [rejected, mail.id],
      );
      await db.query("COMMIT");
      committed = true;
      return true;
    }
    const recent = (
      await db.query(
        "SELECT count(*)::integer AS count FROM email_outbox WHERE last_attempt_at>clock_timestamp()-interval '1 minute'",
      )
    ).rows[0].count;
    if (recent >= maxPerMinute) {
      await db.query("COMMIT");
      committed = true;
      return false;
    }
    await db.query(
      "UPDATE email_outbox SET last_attempt_at=clock_timestamp() WHERE id=$1",
      [mail.id],
    );
    const attempts = mail.attempts + 1;
    let stop: DeliveryError | undefined;
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
    } catch (error) {
      const failure =
        error instanceof DeliveryError
          ? error
          : new DeliveryError("PROVIDER_FAILURE");
      const terminal = failure.permanent || attempts >= 5;
      await db.query(
        "UPDATE email_outbox SET attempts=$1,status=$2,last_error_code=$3,next_attempt_at=clock_timestamp()+($4*interval '1 second'),body=CASE WHEN $6 THEN '[message failed; sensitive content redacted]' ELSE body END WHERE id=$5",
        [
          attempts,
          terminal ? "failed" : "queued",
          failure.code,
          Math.min(3600, 30 * 2 ** (attempts - 1)),
          mail.id,
          terminal,
        ],
      );
      if (failure.haltBatch) stop = failure;
    }
    await db.query("COMMIT");
    committed = true;
    if (stop) throw stop;
    return true;
  } catch (error) {
    if (!committed) await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
