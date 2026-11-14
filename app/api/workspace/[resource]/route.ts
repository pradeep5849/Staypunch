import { z } from "zod";
import { transaction, audit } from "../../../../lib/db";
import {
  checkOrigin,
  hash,
  HttpError,
  propertyAccess,
  requireActor,
  responseError,
  token,
} from "../../../../lib/security";
import { email, profileSchema, roomSchema } from "../../../../lib/validation";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  try {
    checkOrigin(req);
    const u = await requireActor();
    const { resource } = await params;
    const body = await req.json();
    const pid = z.string().uuid().parse(body.propertyId);
    const result = await transaction(u.id, async (db) => {
      await propertyAccess(
        db,
        u,
        pid,
        resource === "staff"
          ? "staff.write"
          : ["support", "reply"].includes(resource)
            ? "support.write"
            : "property.write",
      );
      if (resource === "property") {
        const d = profileSchema.parse(body);
        await db.query(
          "UPDATE properties SET name=$1,type=$2,email=$3,phone=$4,address=$5 WHERE id=$6",
          [d.name, d.type, d.email, d.phone, d.address, pid],
        );
        await db.query("DELETE FROM amenities WHERE property_id=$1", [pid]);
        for (const name of [...new Set(d.amenities)])
          await db.query(
            "INSERT INTO amenities(property_id,name) VALUES($1,$2)",
            [pid, name],
          );
      } else if (resource === "rooms") {
        const d = roomSchema.parse(body);
        await db.query(
          "INSERT INTO room_types(property_id,name,capacity,units) VALUES($1,$2,$3,$4)",
          [pid, d.name, d.capacity, d.units],
        );
      } else if (resource === "staff") {
        const d = z
          .object({ email, role: z.enum(["manager", "staff"]) })
          .parse(body);
        const secret = token();
        await db.query(
          "INSERT INTO staff_invitations(property_id,email,role,token_hash,invited_by,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '3 days')",
          [pid, d.email, d.role, hash(secret), u.id],
        );
        if (!process.env.APP_URL) throw new Error("APP_URL missing");
        await db.query(
          "INSERT INTO email_outbox(recipient,subject,body) VALUES($1,$2,$3)",
          [
            d.email,
            "Invitation to StayPunch360",
            `${process.env.APP_URL}/invite?token=${secret}`,
          ],
        );
      } else if (resource === "support") {
        const d = z
          .object({
            subject: z.string().min(3).max(160),
            message: z.string().min(10).max(4000),
            priority: z.enum(["low", "normal", "high"]),
          })
          .parse(body);
        await db.query(
          "INSERT INTO support_tickets(property_id,user_id,subject,message,priority) VALUES($1,$2,$3,$4,$5)",
          [pid, u.id, d.subject, d.message, d.priority],
        );
      } else if (resource === "reply") {
        const d = z
          .object({
            ticketId: z.string().uuid(),
            message: z.string().min(1).max(4000),
          })
          .parse(body);
        const ticket = await db.query(
          "SELECT id FROM support_tickets WHERE id=$1 AND property_id=$2",
          [d.ticketId, pid],
        );
        if (!ticket.rowCount) throw new HttpError(404, "Ticket not found");
        await db.query(
          "INSERT INTO ticket_messages(ticket_id,user_id,message) VALUES($1,$2,$3)",
          [d.ticketId, u.id, d.message],
        );
      } else throw new HttpError(404, "Unknown resource");
      await audit(db, u.id, `workspace.${resource}.save`, "property", pid);
      return {
        ok: true,
        message:
          resource === "staff"
            ? "Invitation queued for email delivery."
            : "Changes saved.",
      };
    });
    return Response.json(result);
  } catch (e) {
    return responseError(e);
  }
}
