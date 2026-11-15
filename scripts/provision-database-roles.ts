import { Pool } from "pg";
import { readFile } from "node:fs/promises";
import { databaseConfig } from "../lib/database-config";
import { roleCreationCommand } from "./lib/database-roles";
import type { PoolClient } from "pg";

const appPassword = process.env.STAYPUNCH_APP_DATABASE_PASSWORD;
const mailerPassword = process.env.STAYPUNCH_MAILER_DATABASE_PASSWORD;
if (
  !appPassword ||
  !mailerPassword ||
  appPassword === mailerPassword ||
  appPassword.length < 24 ||
  mailerPassword.length < 24
) {
  throw new Error(
    "Two different database passwords of at least 24 characters are required",
  );
}
const pool = new Pool(databaseConfig("migration"));
let client: PoolClient | undefined;
try {
  client = await pool.connect();
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
      throw new Error(
        `Role ${role} already exists; refusing to rotate its password`,
      );
    }
    await client.query(await roleCreationCommand(client, role, secret));
  }
  await client.query(await readFile("db/runtime-grants.sql", "utf8"));
  await client.query(await readFile("db/email-worker-grants.sql", "utf8"));
  await client.query("COMMIT");
  console.log("Restricted database roles created and reviewed grants applied.");
} catch {
  if (client) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Never print database diagnostics: they can contain password-bearing SQL.
    }
  }
  console.error(
    "Database role provisioning failed; existing roles are never overwritten. Check protected configuration and database access privately.",
  );
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}
