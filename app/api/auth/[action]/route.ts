import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { compare, hash as passwordHash } from "bcryptjs";
import { z } from "zod";
import { transaction, audit } from "../../../../lib/db";
import {
  actor,
  checkOrigin,
  cookieOptions,
  hash,
  HttpError,
  rateLimit,
  responseError,
  sessionCookie,
  token,
} from "../../../../lib/security";
import {
  credentials,
  email,
  password,
  registration,
} from "../../../../lib/validation";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    checkOrigin(req);
    const { action } = await params;
    const body = await req.json();
    const address =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "anonymous";
    // Commit throttling independently, including failed attempts. Never trust client-supplied IP headers.
    await transaction(null, (db) =>
      rateLimit(
        db,
        `auth:${action}:${address}`,
        action === "reset-request" ? 3 : 10,
      ),
    );
    if (action === "logout") {
      const value = (await cookies()).get(sessionCookie)?.value;
      if (value)
        await transaction(null, (db) =>
          db.query("DELETE FROM sessions WHERE token_hash=$1", [hash(value)]),
        );
      (await cookies()).delete(sessionCookie);
      return Response.json({ ok: true });
    }
    if (action === "login") {
      const data = credentials.parse(body);
      const u = await transaction(
        null,
        async (db) =>
          (await db.query("SELECT * FROM users WHERE email=$1", [data.email]))
            .rows[0],
      );
      // Equal-cost verification for unknown accounts.
      const valid = await compare(
        data.password,
        u?.password_hash ??
          "$2b$12$XQFhO/j7fCoXzT4DDtqD5O8GBxpZJtnkvvPX5Ldn0uK5CkLBe1hWi",
      );
      if (!u || !valid || u.status !== "active")
        throw new HttpError(401, "Invalid email or password");
      const secret = token();
      await transaction(u.id, async (db) => {
        await db.query(
          "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')",
          [hash(secret), u.id],
        );
        await audit(db, u.id, "auth.login", "user", u.id);
      });
      (await cookies()).set(sessionCookie, secret, cookieOptions);
      return Response.json({
        ok: true,
        redirect: u.platform_role === "super_admin" ? "/admin" : "/app",
      });
    }
    if (action === "register-staff") {
      const data = z
        .object({
          name: z.string().min(2).max(100),
          email,
          password,
          token: z.string().length(64),
        })
        .parse(body);
      const secret = token();
      await transaction(null, async (db) => {
        const u = (
          await db.query(
            "INSERT INTO users(email,name,password_hash) VALUES($1,$2,$3) ON CONFLICT(email) DO NOTHING RETURNING id",
            [data.email, data.name, await passwordHash(data.password, 12)],
          )
        ).rows[0];
        if (!u)
          throw new HttpError(
            409,
            "Account exists. Sign in to accept this invitation.",
          );
        await db.query("SELECT set_config('app.user_id',$1,true)", [u.id]);
        const invitation = (
          await db.query("SELECT * FROM accept_staff_invitation($1,$2)", [
            hash(data.token),
            u.id,
          ])
        ).rows[0];
        if (!invitation)
          throw new HttpError(
            400,
            "Invitation invalid, expired, or does not match this email",
          );
        await db.query(
          "INSERT INTO auth_identities(user_id,subject) VALUES($1,$2)",
          [u.id, data.email],
        );
        await db.query(
          "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')",
          [hash(secret), u.id],
        );
        await audit(db, u.id, "staff.register", "user", u.id);
      });
      (await cookies()).set(sessionCookie, secret, cookieOptions);
      return Response.json({ ok: true, redirect: "/app" });
    }
    if (action === "register") {
      const data = registration.parse(body);
      const encrypted = await passwordHash(data.password, 12);
      const secret = token();
      await transaction(null, async (db) => {
        if (
          (await db.query("SELECT 1 FROM users WHERE email=$1", [data.email]))
            .rowCount
        )
          throw new HttpError(
            409,
            "Unable to register. Try signing in or resetting your password.",
          );
        const u = (
          await db.query(
            "INSERT INTO users(email,name,password_hash) VALUES($1,$2,$3) RETURNING id",
            [data.email, data.name, encrypted],
          )
        ).rows[0];
        await db.query("SELECT set_config('app.user_id',$1,true)", [u.id]);
        await db.query(
          "INSERT INTO auth_identities(user_id,subject) VALUES($1,$2)",
          [u.id, data.email],
        );
        const org = (
          await db.query(
            "INSERT INTO organizations(name,owner_id) VALUES($1,$2) RETURNING id",
            [data.propertyName, u.id],
          )
        ).rows[0];
        const property = { id: randomUUID() };
        await db.query(
          "INSERT INTO properties(id,organization_id,name,email) VALUES($1,$2,$3,$4)",
          [property.id, org.id, data.propertyName, data.email],
        );
        await db.query(
          "INSERT INTO memberships(property_id,user_id,role) VALUES($1,$2,'owner')",
          [property.id, u.id],
        );
        await db.query(
          "INSERT INTO subscriptions(property_id,plan_id,status,renews_at) SELECT $1,id,'trial',now()+trial_days*interval '1 day' FROM plans WHERE id='starter'",
          [property.id],
        );
        await db.query(
          "INSERT INTO leads(kind,name,email,property_name) VALUES('trial',$1,$2,$3)",
          [data.name, data.email, data.propertyName],
        );
        await db.query(
          "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')",
          [hash(secret), u.id],
        );
        await audit(db, u.id, "property.register", "property", property.id);
      });
      (await cookies()).set(sessionCookie, secret, cookieOptions);
      return Response.json({ ok: true, redirect: "/app/property" });
    }
    if (action === "reset-request") {
      const address = email.parse(body.email);
      const secret = token();
      await transaction(null, async (db) => {
        const u = (
          await db.query("SELECT id FROM users WHERE email=$1", [address])
        ).rows[0];
        if (u) {
          await db.query(
            "DELETE FROM auth_tokens WHERE user_id=$1 AND purpose='reset'",
            [u.id],
          );
          await db.query(
            "INSERT INTO auth_tokens(token_hash,user_id,purpose,expires_at) VALUES($1,$2,'reset',now()+interval '30 minutes')",
            [hash(secret), u.id],
          );
          const base = process.env.APP_URL;
          if (!base) throw new Error("APP_URL missing");
          await db.query(
            "INSERT INTO email_outbox(recipient,subject,body) VALUES($1,$2,$3)",
            [
              address,
              "Reset your StayPunch360 password",
              `${base}/reset-password?token=${secret}`,
            ],
          );
        }
      });
      return Response.json({
        ok: true,
        message:
          "If the account exists, a reset email has been queued. Delivery requires the configured email worker.",
      });
    }
    if (action === "reset") {
      const data = z
        .object({ token: z.string().length(64), password })
        .parse(body);
      await transaction(null, async (db) => {
        const u = (
          await db.query(
            "DELETE FROM auth_tokens WHERE token_hash=$1 AND purpose='reset' AND expires_at>now() RETURNING user_id",
            [hash(data.token)],
          )
        ).rows[0];
        if (!u)
          throw new HttpError(
            400,
            "This reset link has expired or was already used",
          );
        await db.query("UPDATE users SET password_hash=$1 WHERE id=$2", [
          await passwordHash(data.password, 12),
          u.user_id,
        ]);
        await db.query("DELETE FROM sessions WHERE user_id=$1", [u.user_id]);
        await audit(db, u.user_id, "auth.password_reset", "user", u.user_id);
      });
      return Response.json({ ok: true, redirect: "/login" });
    }
    if (action === "accept-invite") {
      const u = await actor();
      if (!u)
        throw new HttpError(401, "Sign in before accepting an invitation");
      const value = z.string().length(64).parse(body.token);
      await transaction(u.id, async (db) => {
        const invite = (
          await db.query("SELECT * FROM accept_staff_invitation($1,$2)", [
            hash(value),
            u.id,
          ])
        ).rows[0];
        if (!invite) throw new HttpError(400, "Invitation invalid or expired");
        await audit(
          db,
          u.id,
          "staff.invitation_accepted",
          "property",
          invite.property_id,
        );
      });
      return Response.json({ ok: true, redirect: "/app" });
    }
    throw new HttpError(404, "Unknown action");
  } catch (e) {
    return responseError(e);
  }
}
