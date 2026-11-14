import { X509Certificate } from "node:crypto";
import { appendFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Normalize representation only; every certificate must still be valid X.509. */
export function normalizeCaPem(raw) {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("The configured database CA certificate is missing.");
  }
  const normalized = raw
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n?/g, "\n")
    .trim();
  const blocks = normalized.match(
    /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g,
  );
  try {
    if (
      !blocks?.length ||
      normalized
        .replace(
          /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g,
          "",
        )
        .trim()
    )
      throw new Error();
    for (const block of blocks) new X509Certificate(block);
  } catch {
    throw new Error(
      "The configured database CA certificate is not a valid PEM certificate bundle.",
    );
  }
  return blocks.join("\n") + "\n";
}

export async function installDatabaseCa({ pem, directory, environmentFile }) {
  const normalized = normalizeCaPem(pem);
  if (!directory || !environmentFile)
    throw new Error("GitHub runner certificate paths are not configured.");
  const folder = await mkdtemp(join(directory, "staypunch-database-ca-"));
  const path = join(folder, "ca.pem");
  try {
    await writeFile(path, normalized, { mode: 0o600, flag: "wx" });
    await appendFile(environmentFile, `DATABASE_CA_CERT_FILE=${path}\n`);
    return path;
  } catch {
    await rm(folder, { recursive: true, force: true });
    throw new Error(
      "The database CA certificate could not be installed securely.",
    );
  }
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  try {
    await installDatabaseCa({
      pem: process.env.DATABASE_CA_PEM,
      directory: process.env.RUNNER_TEMP,
      environmentFile: process.env.GITHUB_ENV,
    });
    console.log(
      "Trusted database CA installed; certificate and hostname verification remain enabled.",
    );
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Database CA installation failed.",
    );
    process.exitCode = 1;
  }
}
