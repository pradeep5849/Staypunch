import type { PoolClient } from "pg";
import { enqueueEmail, accountLink } from "./email/messages";
import { hash, token } from "./security";
export async function queueVerification(db: PoolClient, userId: string) {
  const u = (
    await db.query(
      "SELECT email,email_verified_at FROM users WHERE id=$1 AND status='active' FOR UPDATE",
      [userId],
    )
  ).rows[0];
  if (!u || u.email_verified_at) return;
  const secret = token();
  await db.query(
    "DELETE FROM auth_tokens WHERE user_id=$1 AND purpose='verify'",
    [userId],
  );
  await db.query(
    "INSERT INTO auth_tokens(token_hash,user_id,purpose,expires_at) VALUES($1,$2,'verify',now()+interval '24 hours')",
    [hash(secret), userId],
  );
  await enqueueEmail(db, {
    kind: "verification",
    recipient: u.email,
    link: accountLink("/verify-email", secret),
  });
}
