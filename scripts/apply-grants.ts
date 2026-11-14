import { Pool } from "pg";
import { readFile } from "node:fs/promises";
import { databaseConfig } from "../lib/database-config";
const pool = new Pool(databaseConfig("migration"));
const db = await pool.connect();
try {
  await db.query("BEGIN");
  await db.query(await readFile("db/runtime-grants.sql", "utf8"));
  await db.query(await readFile("db/email-worker-grants.sql", "utf8"));
  await db.query("COMMIT");
  console.log("Explicit runtime and mailer grants applied.");
} catch (e) {
  await db.query("ROLLBACK");
  throw e;
} finally {
  db.release();
  await pool.end();
}
