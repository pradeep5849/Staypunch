import { test } from "node:test";
import assert from "node:assert/strict";
import { serviceDiagnostic } from "../lib/service-diagnostics";
import { databaseConfig } from "../lib/database-config";
test("database configuration failures get actionable fixed labels", () => {
  for (const [env, label] of [
    [{}, "database_url_missing"],
    [{ DATABASE_URL: "invalid" }, "database_url_invalid"],
    [
      {
        DATABASE_URL: "postgresql://stay_app@remote.invalid/postgres",
        DATABASE_CA_PEM: "invalid",
      },
      "database_ca_invalid",
    ],
    [
      {
        DATABASE_URL: "postgresql://stay_app@remote.invalid/postgres",
        DATABASE_SSL: "false",
      },
      "database_ssl_setting",
    ],
  ] as const) {
    assert.throws(
      () => databaseConfig("runtime", env),
      (error) => serviceDiagnostic(error) === label,
    );
  }
});
test("driver failures distinguish authentication, TLS and network without exposing diagnostics", () => {
  for (const [code, label] of [
    ["28P01", "database_authentication"],
    ["UNABLE_TO_VERIFY_LEAF_SIGNATURE", "database_ca_trust"],
    ["ERR_TLS_CERT_ALTNAME_INVALID", "database_certificate_hostname"],
    ["ENOTFOUND", "database_dns"],
    ["42501", "database_permissions"],
  ]) {
    const error = Object.assign(new Error("private connection details"), {
      code,
      detail: "private SQL",
    });
    assert.equal(serviceDiagnostic(error), label);
  }
  assert.equal(
    serviceDiagnostic(
      Object.assign(new Error("private details"), {
        code: "unrecognized private value",
      }),
    ),
    "unexpected",
  );
  assert.equal(serviceDiagnostic({ message: "private details" }), "unexpected");
});
