// Creates only an isolated disposable Docker database for local/CI validation.
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { appendFile } from "node:fs/promises";
import { Pool } from "pg";
if (process.env.CI !== "true" || !process.env.GITHUB_ENV)
  throw new Error(
    "This fixture requires CI=true and a validation environment output file",
  );
const name = `staypunch-validation-${randomBytes(6).toString("hex")}`;
const ownerPassword = randomBytes(24).toString("hex");
const appPassword = randomBytes(24).toString("hex");
const mailPassword = randomBytes(24).toString("hex");
const docker = (args: string[], env: NodeJS.ProcessEnv = process.env) =>
  execFileSync("docker", ["--host=unix:///var/run/docker.sock", ...args], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  }).trim();
function connection(user: string, password: string, port: string) {
  const url = new URL("postgresql://127.0.0.1/staypunch");
  url.username = user;
  url.password = password;
  url.port = port;
  return url.toString();
}
let started = false;
try {
  docker(
    [
      "run",
      "--detach",
      "--name",
      name,
      "--env",
      "POSTGRES_PASSWORD",
      "--env",
      "POSTGRES_DB=staypunch",
      "--publish",
      "127.0.0.1::5432",
      "postgres:17-alpine",
    ],
    { ...process.env, POSTGRES_PASSWORD: ownerPassword },
  );
  started = true;
  const port = docker([
    "inspect",
    "--format",
    '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}',
    name,
  ]);
  if (!/^\d+$/.test(port)) throw new Error("Validation port unavailable");
  const ownerURL = connection("postgres", ownerPassword, port);
  const pool = new Pool({
    connectionString: ownerURL,
    connectionTimeoutMillis: 1000,
  });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        await pool.query("SELECT 1");
        ready = true;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    if (!ready) throw new Error("Validation database did not become ready");
    // Passwords are generated hex, never interpolated from user input or printed.
    await pool.query(
      `CREATE ROLE stay_app LOGIN PASSWORD '${appPassword}' NOSUPERUSER NOBYPASSRLS; CREATE ROLE stay_mailer LOGIN PASSWORD '${mailPassword}' NOSUPERUSER NOBYPASSRLS; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;`,
    );
    await pool.query(
      "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO anon,authenticated,service_role",
    );
  } finally {
    await pool.end();
  }
  const appURL = connection("stay_app", appPassword, port),
    mailURL = connection("stay_mailer", mailPassword, port);
  if (process.env.GITHUB_ACTIONS === "true")
    for (const secret of [
      ownerPassword,
      appPassword,
      mailPassword,
      ownerURL,
      appURL,
      mailURL,
    ])
      console.log(`::add-mask::${secret}`);
  await appendFile(
    process.env.GITHUB_ENV!,
    Object.entries({
      MIGRATION_DATABASE_URL: ownerURL,
      TEST_DATABASE_OWNER_URL: ownerURL,
      DATABASE_URL: appURL,
      TEST_DATABASE_URL: appURL,
      TEST_EMAIL_DATABASE_URL: mailURL,
      PG_TOOLS_CONTAINER: name,
    })
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n",
    { mode: 0o600 },
  );
  console.log(
    "Disposable validation database provisioned with generated credentials and simulated hosted roles.",
  );
} catch {
  if (started) docker(["rm", "--force", name]);
  throw new Error(
    "Disposable validation database setup failed; credentials were not logged",
  );
}
