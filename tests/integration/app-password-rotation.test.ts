import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Client, Pool } from "pg";
import {
  appRoleState,
  appVerificationConfig,
  verifyAppPassword,
} from "../../scripts/lib/app-password-rotation";
const run = promisify(execFile);
test(
  "isolated rotation authenticates the new password, rejects the old one, and preserves mailer, grants and records",
  { timeout: 120000 },
  async () => {
    const folder = await mkdtemp(join(tmpdir(), "staypunch-rotation-"));
    const file = join(folder, "fixture.env");
    let container: string | undefined;
    let pool: Pool | undefined;
    let stage = "isolated fixture setup";
    try {
      await run(
        process.execPath,
        ["--import", "tsx", "scripts/setup-validation-database.ts"],
        {
          env: {
            ...process.env,
            CI: "true",
            GITHUB_ACTIONS: "false",
            GITHUB_ENV: file,
          },
          timeout: 60000,
        },
      );
      const env = Object.fromEntries(
        (await readFile(file, "utf8"))
          .trim()
          .split("\n")
          .map((line) => {
            const index = line.indexOf("=");
            return [line.slice(0, index), line.slice(index + 1)];
          }),
      );
      container = env.PG_TOOLS_CONTAINER;
      assert.ok(/^staypunch-validation-[a-f0-9]+$/.test(container));
      const oldUrl = new URL(env.DATABASE_URL);
      assert.equal(oldUrl.hostname, "127.0.0.1");
      pool = new Pool({ connectionString: env.MIGRATION_DATABASE_URL });
      const owner = await pool.connect();
      try {
        await owner.query(
          "CREATE TABLE rotation_records(id int PRIMARY KEY,value text); INSERT INTO rotation_records VALUES(1,'preserved'); CREATE TABLE users(id int PRIMARY KEY,email text,password_hash text); INSERT INTO users VALUES(1,'synthetic-admin@example.test','preserved-hash'); GRANT SELECT ON rotation_records TO stay_app",
        );
        const before = await appRoleState(owner);
        const mailer = (
          await owner.query(
            "SELECT md5(to_jsonb(r)::text) AS fingerprint FROM pg_authid r WHERE rolname='stay_mailer'",
          )
        ).rows[0].fingerprint;
        const records = (
          await owner.query(
            "SELECT md5(to_jsonb(u)::text) AS fingerprint FROM users u",
          )
        ).rows[0].fingerprint;
        const password = randomBytes(32).toString("hex") + "'@:/#?%\\";
        const childEnv: NodeJS.ProcessEnv = {
          ...process.env,
          ...env,
          DATABASE_SSL: "false",
          NODE_ENV: "test",
          STAYPUNCH_APP_DATABASE_PASSWORD: password,
        };
        delete childEnv.DATABASE_CA_PEM;
        delete childEnv.DATABASE_CA_CERT_FILE;
        stage = "password rotation process";
        const result = await run(
          process.execPath,
          ["--import", "tsx", "scripts/rotate-app-database-password.ts"],
          {
            env: childEnv,
            timeout: 45000,
          },
        );
        assert.ok(result.stdout.includes("Fresh stay_app connection verified"));
        for (const secret of [
          password,
          oldUrl.password,
          env.MIGRATION_DATABASE_URL,
        ])
          assert.ok(!`${result.stdout}${result.stderr}`.includes(secret));
        stage = "privilege and record preservation";
        assert.deepEqual(await appRoleState(owner), before);
        assert.ok(
          (
            await owner.query(
              "SELECT md5(to_jsonb(r)::text) AS fingerprint FROM pg_authid r WHERE rolname='stay_mailer'",
            )
          ).rows[0].fingerprint === mailer,
        );
        assert.ok(
          (
            await owner.query(
              "SELECT md5(to_jsonb(u)::text) AS fingerprint FROM users u",
            )
          ).rows[0].fingerprint === records,
        );
        const app = new Client(appVerificationConfig(env, password));
        try {
          await app.connect();
          assert.equal(
            (await app.query("SELECT value FROM rotation_records WHERE id=1"))
              .rows[0].value,
            "preserved",
          );
          assert.equal(
            (
              await app.query(
                "SELECT has_table_privilege(current_user,'rotation_records','INSERT') AS allowed",
              )
            ).rows[0].allowed,
            false,
          );
        } finally {
          await app.end();
        }
        const old = new Client({
          connectionString: oldUrl.toString(),
          connectionTimeoutMillis: 2000,
        });
        let rejected = false;
        try {
          await old.connect();
        } catch (error) {
          rejected = (error as { code?: string }).code === "28P01";
        } finally {
          await old.end();
        }
        assert.equal(rejected, true);
        stage = "restricted-role and missing-role guards";
        const refuse = async (category: string) => {
          let refused = false;
          try {
            await run(
              process.execPath,
              ["--import", "tsx", "scripts/rotate-app-database-password.ts"],
              {
                env: {
                  ...childEnv,
                  STAYPUNCH_APP_DATABASE_PASSWORD:
                    "different-synthetic-candidate-password",
                },
                timeout: 10000,
              },
            );
          } catch (error) {
            const failure = error as {
              code: number;
              stdout: string;
              stderr: string;
            };
            refused =
              failure.code === 1 &&
              failure.stderr.includes(category) &&
              !failure.stdout.includes("rotation committed");
          }
          assert.equal(refused, true);
        };
        await owner.query("ALTER ROLE stay_app CREATEDB");
        await refuse("rotation_role_not_restricted");
        await owner.query("ALTER ROLE stay_app NOCREATEDB");
        await verifyAppPassword(appVerificationConfig(env, password));
        // Only this isolated cluster is modified by these negative cases.
        await owner.query(
          "REVOKE SELECT ON rotation_records FROM stay_app; DROP ROLE stay_app",
        );
        await refuse("rotation_role_missing");
      } finally {
        owner.release();
      }
    } catch (error) {
      const diagnostic = error as { stderr?: string };
      const category =
        diagnostic.stderr?.match(
          /did not confirm a commit \(([a-z_]+)\)/,
        )?.[1] ?? "suppressed";
      throw new Error(
        `Isolated app password rotation test failed at ${stage} (${category}); sensitive diagnostics suppressed`,
      );
    } finally {
      await pool?.end();
      if (container && /^staypunch-validation-[a-f0-9]+$/.test(container))
        await run("docker", [
          "--host=unix:///var/run/docker.sock",
          "rm",
          "--force",
          container,
        ]);
      await rm(folder, { recursive: true, force: true });
    }
  },
);
