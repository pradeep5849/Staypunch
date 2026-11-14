import { Pool } from "pg";
import { readdir, readFile } from "node:fs/promises";
import { modules } from "../lib/modules";
if (!process.env.MIGRATION_DATABASE_URL && !process.env.DATABASE_URL)
  throw new Error("A migration database URL is required");
const pool = new Pool({
  connectionString:
    process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL,
});
const db = await pool.connect();
try {
  await db.query("SELECT pg_advisory_lock(360)");
  await db.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())",
  );
  for (const name of (await readdir("db/migrations"))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    if (
      (await db.query("SELECT 1 FROM schema_migrations WHERE name=$1", [name]))
        .rowCount
    )
      continue;
    await db.query("BEGIN");
    try {
      await db.query(await readFile(`db/migrations/${name}`, "utf8"));
      await db.query("INSERT INTO schema_migrations(name) VALUES($1)", [name]);
      await db.query("COMMIT");
    } catch (e) {
      await db.query("ROLLBACK");
      throw e;
    }
  }
  for (const m of modules)
    await db.query(
      "INSERT INTO feature_registry(id,name,category,description) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,description=excluded.description",
      [m.id, m.name, m.group, m.description],
    );
  console.log("Migrations applied");
} finally {
  await db.query("SELECT pg_advisory_unlock(360)");
  db.release();
  await pool.end();
}
