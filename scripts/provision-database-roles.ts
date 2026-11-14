import { Pool } from "pg";
import { readFile } from "node:fs/promises";
import { databaseConfig } from "../lib/database-config";

const appPassword = process.env.STAYPUNCH_APP_DATABASE_PASSWORD;
const mailerPassword = process.env.STAYPUNCH_MAILER_DATABASE_PASSWORD;
if (!appPassword || !mailerPassword || appPassword === mailerPassword ||
    appPassword.length < 24 || mailerPassword.length < 24) {
  throw new Error("Two different database passwords of at least 24 characters are required");
}
const pool = new Pool(databaseConfig("migration"));
const client = await pool.connect();
try {
  await client.query("BEGIN");
  for (const [role, secret] of [
    ["stay_app", appPassword],
    ["stay_mailer", mailerPassword],
  ] as const) {
    const { rows } = await client.query<{ exists: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname = $1) AS exists",
      [role],
    );
    if (rows[0].exists) {
      throw new Error(`Role ${role} already exists; refusing to rotate its password`);
    }
    const sql = await client.query<{ command: string }>(
      "SELECT format('CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS', $1, $2) AS command",
      [role, secret],
    );
    await client.query(sql.rows[0].command);
  }
  await client.query(await readFile("db/runtime-grants.sql", "utf8"));
  await client.query(await readFile("db/email-worker-grants.sql", "utf8"));
  await client.query("COMMIT");
  console.log("Restricted database roles created and reviewed grants applied.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
