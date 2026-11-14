import { cookies } from "next/headers";
import { transaction } from "../lib/db";
import { hash, sessionCookie, type Actor } from "../lib/security";
import { Badge, Panel } from "./ui";
import { Form } from "./forms";
export function VerificationNotice({ user }: { user: Actor }) {
  return user.email_verified_at ? null : (
    <div className="notice">
      <strong>Email verification pending</strong>
      <p>
        You can continue property setup. Verify your email in account settings
        before inviting staff. Operational modules remain Coming Soon.
      </p>
    </div>
  );
}
export async function AccountSecurity({ user }: { user: Actor }) {
  const current = (await cookies()).get(sessionCookie)?.value;
  const sessions = await transaction(
    user.id,
    async (db) =>
      (
        await db.query(
          "SELECT id,created_at,expires_at,(token_hash=$2) AS current FROM sessions WHERE user_id=$1 AND expires_at>now() ORDER BY created_at DESC",
          [user.id, current ? hash(current) : ""],
        )
      ).rows,
  );
  return (
    <div className="dashboard-grid">
      <Panel title="Email verification">
        <p>{user.email}</p>
        {user.email_verified_at ? (
          <Badge tone="teal">Verified</Badge>
        ) : (
          <>
            <Badge>Verification pending</Badge>
            <p className="muted">
              Messages are queued until a delivery provider is configured and
              tested.
            </p>
            <Form
              endpoint="/api/auth/verify-request"
              label="Queue verification email"
            />
          </>
        )}
      </Panel>
      <Panel title="Active sessions">
        <p className="small muted">
          Revocation applies immediately. Times shown in India Standard Time.
          Device identification and MFA remain future work.
        </p>
        {sessions.map((s) => (
          <div className="record" key={s.id}>
            <p>
              {s.current ? "This session" : "Other session"} · Started{" "}
              {new Intl.DateTimeFormat("en-IN", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Asia/Kolkata",
              }).format(s.created_at)}
            </p>
            <Form
              endpoint="/api/auth/revoke-session"
              values={{ id: s.id }}
              label={s.current ? "Sign out this session" : "Revoke session"}
            />
          </div>
        ))}
        <Form
          endpoint="/api/auth/revoke-sessions"
          label="Sign out all sessions"
        />
      </Panel>
    </div>
  );
}
