import { z } from "zod";
import { transaction } from "../../../../lib/db";
import { canUseModule } from "../../../../lib/modules";
import {
  HttpError,
  checkOrigin,
  propertyAccess,
  requireActor,
  responseError,
} from "../../../../lib/security";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    checkOrigin(req);
    const u = await requireActor();
    const { id } = await params;
    const { propertyId } = z
      .object({ propertyId: z.string().uuid() })
      .parse(await req.json());
    const allowed = await transaction(u.id, async (db) => {
      await propertyAccess(db, u, propertyId, "modules.use");
      const { rows } = await db.query(
        "SELECT f.release_state,e.enabled AS plan_enabled,p.enabled AS property_enabled FROM feature_registry f LEFT JOIN subscriptions s ON s.property_id=$2 AND s.status IN ('active','trial') AND (s.renews_at IS NULL OR s.renews_at>now()) LEFT JOIN feature_entitlements e ON e.feature_id=f.id AND e.plan_id=s.plan_id LEFT JOIN property_entitlements p ON p.feature_id=f.id AND p.property_id=$2 WHERE f.id=$1",
        [id, propertyId],
      );
      const r = rows[0];
      return (
        !!r &&
        canUseModule({
          id,
          releaseState: r.release_state,
          planEnabled: r.plan_enabled === true,
          propertyEnabled: r.property_enabled === true,
          permissions: ["modules.use"],
        })
      );
    });
    if (!allowed)
      throw new HttpError(
        403,
        "Coming Soon — this module has not been released for this property",
      );
    throw new HttpError(501, "No transaction handler is installed");
  } catch (e) {
    return responseError(e);
  }
}
