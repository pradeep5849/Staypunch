import { transaction } from "../../../../lib/db";
import { requireActor, responseError } from "../../../../lib/security";
export async function GET() {
  try {
    const u = await requireActor();
    const sessions = await transaction(
      u.id,
      async (db) =>
        (
          await db.query(
            "SELECT id,created_at,expires_at FROM sessions WHERE user_id=$1 AND expires_at>now() ORDER BY created_at DESC",
            [u.id],
          )
        ).rows,
    );
    return Response.json(
      { sessions },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return responseError(e);
  }
}
