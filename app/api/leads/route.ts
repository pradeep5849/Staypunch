import { transaction } from "../../../lib/db";
import { checkOrigin, rateLimit, responseError } from "../../../lib/security";
import { leadSchema } from "../../../lib/validation";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const data = leadSchema.parse(await req.json());
    await transaction(null, (db) =>
      rateLimit(db, `lead:${data.email}`, 3, 3600),
    );
    await transaction(null, async (db) => {
      await db.query(
        "INSERT INTO leads(kind,name,email,property_name,message) VALUES($1,$2,$3,$4,$5)",
        [data.kind, data.name, data.email, data.propertyName, data.message],
      );
    });
    return Response.json(
      { ok: true, message: "Thank you. Your enquiry has been saved." },
      { status: 201 },
    );
  } catch (e) {
    return responseError(e);
  }
}
