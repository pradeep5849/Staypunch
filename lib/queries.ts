import { transaction } from "./db";
export async function publicPlans() {
  if (!process.env.DATABASE_URL) return null;
  try {
    return await transaction(
      null,
      async (db) =>
        (
          await db.query(
            "SELECT * FROM plans ORDER BY CASE id WHEN 'starter' THEN 1 WHEN 'premium' THEN 2 ELSE 3 END",
          )
        ).rows,
    );
  } catch {
    return null;
  }
}
