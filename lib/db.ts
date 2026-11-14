import { Pool, type PoolClient } from "pg";
const globalDb = globalThis as unknown as { stayPool?: Pool };
export function pool() {
  if (!process.env.DATABASE_URL) throw new Error("Database is not configured");
  return (globalDb.stayPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    ssl:
      process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: true }
        : undefined,
  }));
}
export async function transaction<T>(
  actor: string | null,
  fn: (db: PoolClient) => Promise<T>,
): Promise<T> {
  const db = await pool().connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT set_config('app.user_id',$1,true)", [actor ?? ""]);
    const result = await fn(db);
    await db.query("COMMIT");
    return result;
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  } finally {
    db.release();
  }
}
export async function audit(
  db: PoolClient,
  actor: string | null,
  action: string,
  entity: string,
  entityId?: string,
) {
  await db.query(
    "INSERT INTO audit_logs(actor_id,action,entity,entity_id) VALUES($1,$2,$3,$4)",
    [actor, action, entity, entityId ?? null],
  );
}
