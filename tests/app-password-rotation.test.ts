import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { appVerificationConfig } from "../scripts/lib/app-password-rotation";
const project = "urprqbipwzzezwaodriy";
const password = "synthetic-long-password-'@:/#?%";
test("fresh verification safely derives the custom app role and encodes the password", () => {
  for (const [operator, username] of [
    [
      `postgresql://postgres.${project}@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`,
      `stay_app.${project}`,
    ],
    [`postgresql://postgres@db.${project}.supabase.co/postgres`, "stay_app"],
  ]) {
    const config = appVerificationConfig(
      {
        MIGRATION_DATABASE_URL: operator,
        SUPABASE_PROJECT_REF: project,
        DATABASE_SSL: "true",
      },
      password,
    );
    const url = new URL(config.connectionString!);
    assert.equal(url.username, username);
    assert.ok(decodeURIComponent(url.password) === password);
    assert.deepEqual(config.ssl, { rejectUnauthorized: true });
  }
});
test("rotation configuration refuses weak inputs, another project, and transaction pooling", () => {
  const env = {
    MIGRATION_DATABASE_URL: `postgresql://postgres.${project}@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`,
    SUPABASE_PROJECT_REF: project,
  };
  for (const value of ["", "short", "long-enough-password-with-null\0value"])
    assert.throws(() => appVerificationConfig(env, value));
  assert.throws(() =>
    appVerificationConfig(
      {
        MIGRATION_DATABASE_URL: "postgresql://postgres@localhost/test",
        NODE_ENV: "production",
      },
      password,
    ),
  );
  for (const url of [
    env.MIGRATION_DATABASE_URL.replace(project, "anotherprojectref0000"),
    env.MIGRATION_DATABASE_URL.replace(":5432", ":6543"),
    "postgresql://postgres@unknown.example/postgres",
  ])
    assert.throws(() =>
      appVerificationConfig({ ...env, MIGRATION_DATABASE_URL: url }, password),
    );
});
test("production rotation is manual, main-only, protected and isolated from provisioning/mailer secrets", () => {
  const workflow = readFileSync(
    ".github/workflows/manual-app-password-rotate.yml",
    "utf8",
  );
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /github.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /ROTATE-STAYPUNCH-APP-PASSWORD/);
  assert.match(workflow, /environment: staypunch360-production/);
  assert.match(workflow, /group: staypunch360-production-database/);
  assert.match(workflow, /DATABASE_SSL: "true"/);
  assert.match(workflow, /secrets.STAYPUNCH_APP_DATABASE_PASSWORD/);
  assert.doesNotMatch(
    workflow,
    /STAYPUNCH_MAILER_DATABASE_PASSWORD|provision-database-roles|bootstrap-admin/,
  );
});
