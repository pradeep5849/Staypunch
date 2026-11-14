import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dropTestDatabase } from "../../scripts/lib/test-database";
import { Client, Pool } from "pg";
const runFile = promisify(execFile);
test("upgrading the populated original foundation preserves accounts, sessions, tokens and property data", async () => {
  assert.ok(
    process.env.TEST_DATABASE_OWNER_URL && process.env.TEST_DATABASE_URL,
    "Disposable test URLs required",
  );
  const source = new URL(process.env.TEST_DATABASE_OWNER_URL);
  assert.ok(
    ["localhost", "127.0.0.1", "[::1]"].includes(source.hostname) &&
      !source.search,
    "Upgrade drill is local only",
  );
  const name = `staypunch_upgrade_${randomUUID().replaceAll("-", "")}`;
  const cluster = new Pool({ connectionString: source.toString() });
  let created = false;
  try {
    await cluster.query(`CREATE DATABASE "${name}"`);
    created = true;
    const targetURL = new URL(source);
    targetURL.pathname = `/${name}`;
    const target = new Client({ connectionString: targetURL.toString() });
    const user = randomUUID(),
      org = randomUUID(),
      property = randomUUID();
    const session = randomUUID().replaceAll("-", "");
    const reset = randomUUID().replaceAll("-", "");
    try {
      await target.connect();
      await target.query(
        "CREATE TABLE schema_migrations(name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())",
      );
      await target.query(
        "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO anon,authenticated,service_role",
      );
      for (const file of [
        "001_foundation.sql",
        "002_invitation.sql",
        "003_security_architecture.sql",
      ]) {
        await target.query(await readFile(`db/migrations/${file}`, "utf8"));
        await target.query("INSERT INTO schema_migrations(name) VALUES($1)", [
          file,
        ]);
      }
      await target.query(
        "INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,'Upgrade fixture owner','upgrade-fixture-hash')",
        [user, `upgrade-${user}@example.test`],
      );
      await target.query(
        "INSERT INTO organizations(id,name,owner_id) VALUES($1,'Upgrade fixture org',$2)",
        [org, user],
      );
      await target.query(
        "INSERT INTO properties(id,organization_id,name,address) VALUES($1,$2,'Upgrade fixture hotel','Preserved address')",
        [property, org],
      );
      await target.query(
        "INSERT INTO memberships(property_id,user_id,role) VALUES($1,$2,'owner')",
        [property, user],
      );
      await target.query(
        "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 day')",
        [session, user],
      );
      await target.query(
        "INSERT INTO auth_tokens(token_hash,user_id,purpose,expires_at) VALUES($1,$2,'reset',now()+interval '30 minutes')",
        [reset, user],
      );
      await target.query(
        "INSERT INTO email_outbox(recipient,subject,body) VALUES($1,'Existing queued fixture','Preserved queued body')",
        [`upgrade-${user}@example.test`],
      );
      try {
        await runFile("node_modules/.bin/tsx", ["scripts/migrate.ts"], {
          env: { ...process.env, MIGRATION_DATABASE_URL: targetURL.toString() },
          timeout: 120000,
        });
      } catch {
        throw new Error("Isolated upgrade migration failed");
      }
      await target.query(await readFile("db/runtime-grants.sql", "utf8"));
      await target.query(await readFile("db/email-worker-grants.sql", "utf8"));
      const account = (
        await target.query(
          "SELECT password_hash,email_verified_at FROM users WHERE id=$1",
          [user],
        )
      ).rows[0];
      assert.equal(account.password_hash, "upgrade-fixture-hash");
      assert.equal(account.email_verified_at, null);
      assert.equal(
        (
          await target.query("SELECT address FROM properties WHERE id=$1", [
            property,
          ])
        ).rows[0].address,
        "Preserved address",
      );
      assert.ok(
        (
          await target.query("SELECT id FROM sessions WHERE token_hash=$1", [
            session,
          ])
        ).rows[0].id,
      );
      assert.equal(
        (
          await target.query(
            "SELECT purpose FROM auth_tokens WHERE token_hash=$1",
            [reset],
          )
        ).rows[0].purpose,
        "reset",
      );
      assert.equal(
        (await target.query("SELECT body FROM email_outbox")).rows[0].body,
        "Preserved queued body",
      );
      assert.equal(
        (await target.query("SELECT count(*) total FROM feature_registry"))
          .rows[0].total,
        "39",
      );
      assert.equal(
        (
          await target.query(
            "SELECT count(*) total FROM feature_registry WHERE release_state='released'",
          )
        ).rows[0].total,
        "0",
      );
      assert.equal(
        (
          await target.query(
            "SELECT has_table_privilege('anon','public.users','SELECT') allowed",
          )
        ).rows[0].allowed,
        false,
      );
      const runtimeURL = new URL(process.env.TEST_DATABASE_URL);
      runtimeURL.pathname = `/${name}`;
      const db = new Client({ connectionString: runtimeURL.toString() });
      try {
        await db.connect();
        await db.query("BEGIN");
        await db.query("SELECT set_config('app.user_id',$1,true)", [user]);
        assert.equal(
          (await db.query("SELECT name FROM properties")).rows[0].name,
          "Upgrade fixture hotel",
        );
        await db.query("ROLLBACK");
      } finally {
        await db.end();
      }
    } finally {
      await target.end();
    }
  } finally {
    try {
      if (created) await dropTestDatabase(cluster, name);
    } finally {
      await cluster.end();
    }
  }
});
