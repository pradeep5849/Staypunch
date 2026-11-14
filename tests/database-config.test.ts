import { test } from "node:test";
import assert from "node:assert/strict";
import { databaseConfig } from "../lib/database-config";
import { rootCertificates } from "node:tls";
import { normalizeCaPem } from "../lib/database-ca.mjs";
const local = "postgresql://stay_app@localhost:5432/staypunch";
test("managed-host CA supports escaped PEM and preserves certificate and hostname verification", () => {
  const pem = rootCertificates[0];
  const ssl = databaseConfig("runtime", {
    DATABASE_URL: "postgresql://stay_app@db.example.invalid/postgres",
    DATABASE_CA_PEM: pem.replaceAll("\n", "\\n"),
  }).ssl;
  assert.deepEqual(ssl, { rejectUnauthorized: true, ca: normalizeCaPem(pem) });
  assert.throws(
    () =>
      databaseConfig("runtime", {
        DATABASE_URL: local,
        DATABASE_CA_PEM: "bad",
      }),
    /valid PEM/,
  );
  assert.throws(
    () =>
      databaseConfig("runtime", {
        DATABASE_URL: local,
        DATABASE_CA_PEM: pem,
        DATABASE_CA_CERT_FILE: "/unused",
      }),
    /only one/,
  );
});
test("database roles require independent connection variables and bounded pool settings", () => {
  assert.throws(
    () => databaseConfig("migration", { DATABASE_URL: local }),
    /MIGRATION_DATABASE_URL/,
  );
  assert.throws(
    () => databaseConfig("email", { MIGRATION_DATABASE_URL: local }),
    /EMAIL_DATABASE_URL/,
  );
  assert.equal(databaseConfig("runtime", { DATABASE_URL: local }).max, 5);
  assert.equal(
    databaseConfig("migration", { MIGRATION_DATABASE_URL: local }).max,
    1,
  );
  assert.throws(
    () =>
      databaseConfig("runtime", {
        DATABASE_URL: local,
        DATABASE_POOL_MAX: "999",
      }),
    /Invalid/,
  );
});
test("remote PostgreSQL always verifies TLS and URL options cannot silently disable it", () => {
  const remote = "postgresql://stay_app@db.example.invalid:5432/staypunch";
  assert.deepEqual(databaseConfig("runtime", { DATABASE_URL: remote }).ssl, {
    rejectUnauthorized: true,
  });
  for (const config of [
    { DATABASE_URL: remote, DATABASE_SSL: "false" },
    { DATABASE_URL: remote + "?sslmode=no-verify" },
    { DATABASE_URL: remote + "?sslmode=require" },
    { DATABASE_URL: remote + "?sslrootcert=ignore" },
    { DATABASE_URL: remote + "?ssl=0" },
    { DATABASE_URL: remote + "?host=localhost" },
    { DATABASE_URL: remote + "?statement_timeout=0" },
  ])
    assert.throws(() => databaseConfig("runtime", config));
  const config = databaseConfig("runtime", {
    DATABASE_URL: remote + "?sslmode=verify-full",
  });
  assert.ok(!config.connectionString?.includes("sslmode"));
  assert.deepEqual(config.ssl, { rejectUnauthorized: true });
});
test("loopback PostgreSQL remains available without TLS; migrations reject transaction pooler", () => {
  assert.equal(
    databaseConfig("runtime", { DATABASE_URL: local, DATABASE_SSL: "false" })
      .ssl,
    false,
  );
  assert.throws(
    () =>
      databaseConfig("migration", {
        MIGRATION_DATABASE_URL:
          "postgresql://operator@pooler.example.invalid:6543/postgres",
      }),
    /direct or session/,
  );
  assert.throws(
    () =>
      databaseConfig("runtime", {
        DATABASE_URL: local + "?sslmode=disable",
        DATABASE_SSL: "true",
      }),
    /Conflicting/,
  );
});
