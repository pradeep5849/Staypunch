import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { PoolClient } from "pg";
import { transaction } from "./db";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const token = () => randomBytes(32).toString("hex");
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const sessionCookie = "stay_session";
export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};
export type Actor = {
  id: string;
  name: string;
  email: string;
  platform_role: string;
  status: string;
  email_verified_at: Date | null;
};
export async function actor(): Promise<Actor | null> {
  const value = (await cookies()).get(sessionCookie)?.value;
  if (!value) return null;
  return transaction(
    null,
    async (db) =>
      (
        await db.query(
          "SELECT u.id,u.name,u.email,u.platform_role,u.status,u.email_verified_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.status='active'",
          [hash(value)],
        )
      ).rows[0] ?? null,
  );
}
export async function requireActor() {
  const u = await actor();
  if (!u) throw new HttpError(401, "Please sign in");
  return u;
}
export async function requireAdmin() {
  const u = await requireActor();
  if (u.platform_role !== "super_admin")
    throw new HttpError(403, "Platform administrator access required");
  return u;
}
export async function propertyAccess(
  db: PoolClient,
  user: Actor,
  propertyId: string,
  permission: string,
) {
  const result = await db.query(
    "SELECT m.role,p.status FROM memberships m JOIN properties p ON p.id=m.property_id WHERE m.user_id=$1 AND m.property_id=$2",
    [user.id, propertyId],
  );
  const row = result.rows[0];
  if (!row || row.status === "suspended" || row.status === "rejected")
    throw new HttpError(403, "Property access unavailable");
  if (
    ["staff.write", "modules.use"].includes(permission) &&
    !user.email_verified_at
  )
    throw new HttpError(
      403,
      "Verify your email before inviting staff or using operational modules",
    );
  const permissions: Record<string, string[]> = {
    owner: [
      "property.read",
      "property.write",
      "staff.write",
      "support.write",
      "modules.use",
    ],
    manager: [
      "property.read",
      "property.write",
      "support.write",
      "modules.use",
    ],
    staff: ["property.read", "support.write", "modules.use"],
  };
  if (!permissions[row.role]?.includes(permission))
    throw new HttpError(403, "Permission denied");
  return row;
}
export function checkOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const expected = new URL(req.url).origin;
  if (!origin || origin !== expected)
    throw new HttpError(403, "Invalid request origin");
}
export async function rateLimit(
  db: PoolClient,
  key: string,
  max = 10,
  windowSeconds = 900,
) {
  const { rows } = await db.query(
    "INSERT INTO rate_limits(key,count,expires_at) VALUES($1,1,now()+($2*interval '1 second')) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.expires_at<now() THEN 1 ELSE rate_limits.count+1 END,expires_at=CASE WHEN rate_limits.expires_at<now() THEN now()+($2*interval '1 second') ELSE rate_limits.expires_at END RETURNING count",
    [hash(key), windowSeconds],
  );
  if (rows[0].count > max)
    throw new HttpError(429, "Too many requests. Please try again later.");
}
export function responseError(e: unknown) {
  if (e instanceof HttpError)
    return Response.json({ error: e.message }, { status: e.status });
  if (e instanceof SyntaxError)
    return Response.json({ error: "Invalid JSON request" }, { status: 400 });
  if (e instanceof Error && e.name === "ZodError")
    return Response.json(
      { error: "Please check the form fields" },
      { status: 400 },
    );
  console.error("Request failed", e instanceof Error ? e.name : "unknown");
  return Response.json(
    { error: "Service unavailable. Please try again later." },
    { status: 503 },
  );
}
