import { Client, Pool } from "pg";
import { dropTestDatabase } from "./lib/test-database";
import { randomUUID } from "node:crypto";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
// This automated drill is deliberately limited to an explicitly opted-in local TEST database.
if (
  process.env.ALLOW_RESTORE_DRILL !== "true" ||
  !process.env.TEST_DATABASE_OWNER_URL ||
  !process.env.TEST_DATABASE_URL
)
  throw new Error(
    "Explicit local test database URLs and ALLOW_RESTORE_DRILL=true are required",
  );
const sourceURL = new URL(process.env.TEST_DATABASE_OWNER_URL);
if (!["localhost", "127.0.0.1", "[::1]"].includes(sourceURL.hostname))
  throw new Error(
    "Automated restore drill only supports local disposable test databases",
  );
const runtimeURL = new URL(process.env.TEST_DATABASE_URL);
if (
  sourceURL.search ||
  runtimeURL.search ||
  !["postgres:", "postgresql:"].includes(sourceURL.protocol) ||
  !["postgres:", "postgresql:"].includes(runtimeURL.protocol)
)
  throw new Error("Drill URLs must be PostgreSQL URLs without query overrides");
if (
  runtimeURL.hostname !== sourceURL.hostname ||
  runtimeURL.port !== sourceURL.port ||
  runtimeURL.pathname !== sourceURL.pathname
)
  throw new Error(
    "Runtime and owner test URLs must identify the same local database",
  );
const owner = new Pool({ connectionString: sourceURL.toString() });
const targetName = `staypunch_restore_${randomUUID().replaceAll("-", "")}`;
const directory = await mkdtemp(join(tmpdir(), "staypunch-restore-"));
let created = false;
async function pgTool(
  command: string,
  args: string[],
  database: string,
  input?: Buffer,
) {
  const container = process.env.PG_TOOLS_CONTAINER;
  const env = {
    ...process.env,
    PGHOST: container ? "127.0.0.1" : sourceURL.hostname,
    PGPORT: container ? "5432" : sourceURL.port || "5432",
    PGUSER: decodeURIComponent(sourceURL.username),
    PGPASSWORD: decodeURIComponent(sourceURL.password),
    PGDATABASE: database,
  };
  const executable = container ? "docker" : command;
  const cli = container
    ? [
        "--host=unix:///var/run/docker.sock",
        "exec",
        "-i",
        ...["PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE"].flatMap(
          (n) => ["--env", n],
        ),
        container,
        command,
        ...args,
      ]
    : args;
  return new Promise<Buffer>((resolve, reject) => {
    const proc = spawn(executable, cli, {
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const output: Buffer[] = [];
    let length = 0;
    proc.stdout.on("data", (b: Buffer) => {
      length += b.length;
      if (length > 64 * 1024 * 1024) {
        proc.kill();
        reject(new Error("Test backup exceeds drill size limit"));
      } else output.push(b);
    });
    proc.stderr.resume();
    proc.on("error", () => reject(new Error(`${command} is unavailable`)));
    proc.on("close", (code) =>
      code === 0
        ? resolve(Buffer.concat(output))
        : reject(
            new Error(`${command} failed; no production operations attempted`),
          ),
    );
    proc.stdin.end(input);
  });
}
try {
  const source = await owner.connect();
  let counts: { name: string; total: string }[];
  try {
    await source.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const snapshot = (await source.query("SELECT pg_export_snapshot() id"))
      .rows[0].id;
    const tables = (
      await source.query(
        "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
      )
    ).rows;
    counts = [];
    for (const t of tables) {
      assert.match(t.tablename, /^[a-z_]+$/);
      counts.push({
        name: t.tablename,
        total: (
          await source.query(
            `SELECT count(*) total FROM public."${t.tablename}"`,
          )
        ).rows[0].total,
      });
    }
    const dump = await pgTool(
      "pg_dump",
      ["--format=custom", "--no-owner", "--no-acl", `--snapshot=${snapshot}`],
      sourceURL.pathname.slice(1),
    );
    await writeFile(join(directory, "snapshot.dump"), dump, { mode: 0o600 });
    await source.query("COMMIT");
  } catch (e) {
    await source.query("ROLLBACK");
    throw e;
  } finally {
    source.release();
  }
  await owner.query(`CREATE DATABASE "${targetName}"`);
  created = true;
  await pgTool(
    "pg_restore",
    ["--exit-on-error", "--no-owner", "--no-acl", "--dbname", targetName],
    targetName,
    await readFile(join(directory, "snapshot.dump")),
  );
  const targetURL = new URL(sourceURL);
  targetURL.pathname = `/${targetName}`;
  const target = new Client({ connectionString: targetURL.toString() });
  try {
    await target.connect();
    for (const t of counts!)
      assert.equal(
        (await target.query(`SELECT count(*) total FROM public."${t.name}"`))
          .rows[0].total,
        t.total,
        `Restored row count: ${t.name}`,
      );
    await target.query(await readFile("db/runtime-grants.sql", "utf8"));
    for (const role of ["anon", "authenticated", "service_role"]) {
      if (
        !(await target.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [role]))
          .rowCount
      )
        continue;
      assert.equal(
        (
          await target.query(
            "SELECT has_function_privilege($1,'stay_private.is_platform_admin()','EXECUTE') allowed",
            [role],
          )
        ).rows[0].allowed,
        false,
        "Privileged helper ACL restored",
      );
      assert.equal(
        (
          await target.query(
            "SELECT has_table_privilege($1,'public.users','SELECT') allowed",
            [role],
          )
        ).rows[0].allowed,
        false,
        "Private identity ACL restored",
      );
    }
    const flags = (
      await target.query(
        "SELECT count(*) total FROM feature_registry WHERE release_state='released'",
      )
    ).rows[0].total;
    assert.equal(flags, "0", "Restore must not introduce module releases");
    assert.equal(
      (
        await target.query(
          "SELECT count(*) total FROM pg_tables WHERE schemaname='public' AND NOT rowsecurity",
        )
      ).rows[0].total,
      "0",
    );
  } finally {
    await target.end();
  }
  const appTargetURL = new URL(runtimeURL);
  appTargetURL.pathname = `/${targetName}`;
  const app = new Client({ connectionString: appTargetURL.toString() });
  try {
    await app.connect();
    assert.equal(
      (await app.query("SELECT count(*) total FROM properties")).rows[0].total,
      "0",
      "Anonymous app context cannot read tenant properties",
    );
    await assert.rejects(
      app.query("SELECT * FROM auth_factors"),
      /permission denied/,
    );
  } finally {
    await app.end();
  }
  console.log(
    `Restore drill passed: ${counts!.length} tables reconciled, RLS retained, runtime isolation verified, zero released modules. Temporary database and backup are removed.`,
  );
} finally {
  try {
    if (created) await dropTestDatabase(owner, targetName);
  } finally {
    try {
      await owner.end();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
