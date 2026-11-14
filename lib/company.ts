import { transaction } from "./db";
export async function companyInfo(): Promise<{
  name: string;
  contactEmail: string;
  supportEmail: string;
} | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    return await transaction(
      null,
      async (db) =>
        (
          await db.query(
            "SELECT value FROM platform_settings WHERE key='company'",
          )
        ).rows[0]?.value ?? null,
    );
  } catch {
    return null;
  }
}
