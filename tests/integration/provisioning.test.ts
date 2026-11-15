import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Pool } from "pg";
import { roleCreationCommand } from "../../scripts/lib/database-roles";
const runFile = promisify(execFile);

test("PostgreSQL can resolve role command parameters and safely quote password literals", async () => {
  assert.ok(
    process.env.TEST_DATABASE_OWNER_URL,
    "Disposable owner URL required",
  );
  const pool = new Pool({
    connectionString: process.env.TEST_DATABASE_OWNER_URL,
  });
  const client = await pool.connect();
  try {
    const command = await roleCreationCommand(
      client,
      "stay_app",
      "synthetic'quote\\value",
    );
    assert.ok(command.startsWith("CREATE ROLE stay_app LOGIN PASSWORD "));
    assert.ok(command.includes("synthetic''quote"));
    for (const restriction of [
      "NOSUPERUSER",
      "NOCREATEDB",
      "NOCREATEROLE",
      "NOREPLICATION",
      "NOBYPASSRLS",
    ])
      assert.ok(command.includes(restriction));
  } finally {
    client.release();
    await pool.end();
  }
});

test("provisioning refuses existing roles without rotating passwords or printing credentials", async () => {
  assert.ok(
    process.env.TEST_DATABASE_OWNER_URL && process.env.TEST_DATABASE_URL,
    "Disposable test URLs required",
  );
  const url = new URL(process.env.TEST_DATABASE_OWNER_URL);
  assert.ok(
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname),
    "Local disposable database only",
  );
  const appPassword = randomBytes(32).toString("hex");
  const mailPassword = randomBytes(32).toString("hex");
  let failed = false;
  try {
    await runFile(
      process.execPath,
      ["--import", "tsx", "scripts/provision-database-roles.ts"],
      {
        env: {
          ...process.env,
          MIGRATION_DATABASE_URL: url.toString(),
          STAYPUNCH_APP_DATABASE_PASSWORD: appPassword,
          STAYPUNCH_MAILER_DATABASE_PASSWORD: mailPassword,
        },
        timeout: 30000,
      },
    );
  } catch (error) {
    failed = true;
    const failure = error as { code: number; stdout: string; stderr: string };
    assert.equal(failure.code, 1);
    assert.ok(failure.stderr.includes("existing roles are never overwritten"));
    for (const secret of [appPassword, mailPassword, url.password])
      assert.ok(!`${failure.stdout}${failure.stderr}`.includes(secret));
  }
  assert.equal(failed, true);
  const app = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  try {
    const {
      rows: [role],
    } = await app.query(
      "SELECT current_user AS name,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user",
    );
    assert.equal(role.name, "stay_app");
    assert.equal(role.rolsuper, false);
    assert.equal(role.rolbypassrls, false);
  } finally {
    await app.end();
  }
});
