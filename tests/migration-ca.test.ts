import { test } from "node:test";
import assert from "node:assert/strict";
import { rootCertificates } from "node:tls";
import { X509Certificate } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  installDatabaseCa,
  normalizeCaPem,
} from "../scripts/install-database-ca.mjs";

// Public CA bundled with Node, never a project secret or a test-only production trust override.
const publicCa = rootCertificates[0].trim();
test("CA normalization preserves trusted bytes for multiline, escaped and flattened hosting values", () => {
  const expected = new X509Certificate(publicCa).fingerprint256;
  for (const input of [
    publicCa,
    publicCa + "\n",
    publicCa.replaceAll("\n", "\r\n"),
    publicCa.replaceAll("\n", "\\n"),
    publicCa.replaceAll("\n", "\\r\\n"),
    publicCa.replaceAll("\n", ""),
    publicCa.replaceAll("\n", " "),
  ]) {
    const normalized = normalizeCaPem(input);
    assert.ok(normalized.endsWith("\n"));
    assert.ok(!normalized.includes("\\n"));
    assert.equal(new X509Certificate(normalized).fingerprint256, expected);
  }
  assert.equal(
    (
      normalizeCaPem(publicCa + "\n" + publicCa).match(/BEGIN CERTIFICATE/g) ??
      []
    ).length,
    2,
  );
});
test("invalid/missing CA fails without echoing its contents", () => {
  for (const input of [
    undefined,
    "",
    "invalid-sensitive-value",
    publicCa + "junk",
    "-----BEGIN CERTIFICATE-----\ninvalid\n-----END CERTIFICATE-----",
    publicCa.replace("MI", "M#I"),
    publicCa.replace("MI", "MII"),
  ]) {
    assert.throws(
      () => normalizeCaPem(input),
      (error) =>
        error instanceof Error &&
        /certificate/.test(error.message) &&
        !error.message.includes("sensitive-value"),
    );
  }
});
test("workflow CA installation writes a private certificate file and exports only its path", async () => {
  const directory = await mkdtemp(join(tmpdir(), "staypunch-ca-test-"));
  try {
    const environmentFile = join(directory, "environment");
    await writeFile(environmentFile, "", { mode: 0o600 });
    const path = await installDatabaseCa({
      pem: publicCa.replaceAll("\n", "\\n"),
      directory,
      environmentFile,
    });
    const text = await readFile(path, "utf8");
    assert.equal(
      new X509Certificate(text).fingerprint256,
      new X509Certificate(publicCa).fingerprint256,
    );
    assert.equal((await stat(path)).mode & 0o777, 0o600);
    assert.equal(
      await readFile(environmentFile, "utf8"),
      `DATABASE_CA_CERT_FILE=${path}\n`,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test("production migration workflow stays manual, main-only, environment-scoped and TLS-verified", async () => {
  const workflow = await readFile(
    ".github/workflows/manual-database-migrate.yml",
    "utf8",
  );
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /confirmation == 'MIGRATE-STAYPUNCH360'/);
  assert.match(workflow, /environment: staypunch360-production/);
  assert.match(workflow, /DATABASE_SSL: ['"]true['"]/);
  assert.match(workflow, /npm ci --include=dev/);
  assert.match(workflow, /node scripts\/install-database-ca\.mjs/);
  assert.match(workflow, /cancel-in-progress: false/);
});
