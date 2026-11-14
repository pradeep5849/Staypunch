import { z } from "zod";
import { audit, transaction } from "../../../../lib/db";
import {
  checkOrigin,
  HttpError,
  requireAdmin,
  responseError,
} from "../../../../lib/security";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  try {
    checkOrigin(req);
    const u = await requireAdmin();
    const { resource } = await params;
    const b = await req.json();
    await transaction(u.id, async (db) => {
      if (resource === "properties") {
        const d = z
          .object({
            id: z.string().uuid(),
            status: z.enum(["active", "suspended", "rejected", "pending"]),
          })
          .parse(b);
        await db.query("UPDATE properties SET status=$1 WHERE id=$2", [
          d.status,
          d.id,
        ]);
      } else if (resource === "customers") {
        const d = z
          .object({
            id: z.string().uuid(),
            status: z.enum(["active", "suspended"]),
          })
          .parse(b);
        if (d.id === u.id)
          throw new HttpError(400, "Cannot suspend your own account");
        await db.query(
          "UPDATE users SET status=$1 WHERE id=$2 AND platform_role='customer'",
          [d.status, d.id],
        );
        if (d.status === "suspended")
          await db.query("DELETE FROM sessions WHERE user_id=$1", [d.id]);
      } else if (resource === "plans") {
        const d = z
          .object({
            id: z.string().regex(/^[a-z0-9-]{2,40}$/),
            name: z.string().min(2).max(80),
            price: z.union([
              z.literal(""),
              z.coerce.number().min(0).max(10000000),
            ]),
            currency: z.string().regex(/^[A-Z]{3}$/),
            trialDays: z.coerce.number().int().min(0).max(365),
            features: z.string().max(3000),
          })
          .parse(b);
        await db.query(
          "INSERT INTO plans(id,name,price_minor,currency,trial_days,features) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET name=$2,price_minor=$3,currency=$4,trial_days=$5,features=$6",
          [
            d.id,
            d.name,
            d.price === "" ? null : Math.round(Number(d.price) * 100),
            d.currency,
            d.trialDays,
            d.features
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
          ],
        );
      } else if (resource === "subscriptions") {
        const d = z
          .object({
            propertyId: z.string().uuid(),
            planId: z.string().min(1),
            status: z.enum(["trial", "active", "expired", "cancelled"]),
            renewsAt: z.string().datetime().nullable(),
          })
          .parse(b);
        await db.query(
          "INSERT INTO subscriptions(property_id,plan_id,status,renews_at) VALUES($1,$2,$3,$4) ON CONFLICT(property_id) DO UPDATE SET plan_id=$2,status=$3,renews_at=$4",
          [d.propertyId, d.planId, d.status, d.renewsAt],
        );
      } else if (resource === "modules") {
        const d = z
          .object({
            id: z.string(),
            developmentStatus: z.enum([
              "planned",
              "in_development",
              "testing",
              "complete",
            ]),
            releaseState: z.enum([
              "planned",
              "in_development",
              "testing",
              "disabled",
            ]),
          })
          .parse(b);
        await db.query(
          "UPDATE feature_registry SET development_status=$1,release_state=$2 WHERE id=$3",
          [d.developmentStatus, d.releaseState, d.id],
        );
      } else if (resource === "entitlements") {
        const d = z
          .object({
            id: z.string(),
            planId: z.string().optional(),
            propertyId: z.string().uuid().optional(),
            enabled: z.boolean(),
          })
          .refine((d) => !!d.planId !== !!d.propertyId)
          .parse(b);
        if (d.planId)
          await db.query(
            "INSERT INTO feature_entitlements(feature_id,plan_id,enabled) VALUES($1,$2,$3) ON CONFLICT(feature_id,plan_id) DO UPDATE SET enabled=$3",
            [d.id, d.planId, d.enabled],
          );
        else
          await db.query(
            "INSERT INTO property_entitlements(feature_id,property_id,enabled) VALUES($1,$2,$3) ON CONFLICT(feature_id,property_id) DO UPDATE SET enabled=$3",
            [d.id, d.propertyId, d.enabled],
          );
      } else if (resource === "leads") {
        const d = z
          .object({
            id: z.string().uuid(),
            status: z.enum(["new", "contacted", "qualified", "closed"]),
            notes: z.string().max(5000),
            assignedTo: z.string().uuid().nullable(),
          })
          .parse(b);
        if (
          d.assignedTo &&
          !(
            await db.query(
              "SELECT 1 FROM users WHERE id=$1 AND platform_role='super_admin' AND status='active'",
              [d.assignedTo],
            )
          ).rowCount
        )
          throw new HttpError(
            400,
            "Assignee must be an active platform administrator",
          );
        await db.query(
          "UPDATE leads SET status=$1,notes=$2,assigned_to=$3 WHERE id=$4",
          [d.status, d.notes, d.assignedTo, d.id],
        );
      } else if (resource === "support") {
        const d = z
          .object({
            id: z.string().uuid(),
            status: z.enum(["open", "in_progress", "resolved"]),
            priority: z.enum(["low", "normal", "high"]),
            assignedTo: z.string().uuid().nullable(),
            reply: z.string().max(4000),
          })
          .parse(b);
        if (
          d.assignedTo &&
          !(
            await db.query(
              "SELECT 1 FROM users WHERE id=$1 AND platform_role='super_admin'",
              [d.assignedTo],
            )
          ).rowCount
        )
          throw new HttpError(400, "Invalid assignee");
        await db.query(
          "UPDATE support_tickets SET status=$1,priority=$2,assigned_to=$3 WHERE id=$4",
          [d.status, d.priority, d.assignedTo, d.id],
        );
        if (d.reply)
          await db.query(
            "INSERT INTO ticket_messages(ticket_id,user_id,message) VALUES($1,$2,$3)",
            [d.id, u.id, d.reply],
          );
      } else if (resource === "settings") {
        const d = z
          .object({
            name: z.string().min(2).max(100),
            contactEmail: z.string().email().or(z.literal("")),
            supportEmail: z.string().email().or(z.literal("")),
          })
          .parse(b);
        await db.query(
          "UPDATE platform_settings SET value=$1 WHERE key='company'",
          [JSON.stringify(d)],
        );
      } else throw new HttpError(404, "Unknown resource");
      await audit(
        db,
        u.id,
        `admin.${resource}.save`,
        resource,
        typeof b.id === "string" ? b.id : undefined,
      );
    });
    return Response.json({ ok: true, message: "Changes saved." });
  } catch (e) {
    return responseError(e);
  }
}
