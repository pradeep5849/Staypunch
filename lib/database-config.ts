import { readFileSync } from "node:fs";
import type { PoolConfig } from "pg";
import { normalizeCaPem } from "./database-ca.mjs";
export type DatabasePurpose = "runtime" | "migration" | "email";
function integer(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  if (value === undefined || value === "") return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max)
    throw new Error("Invalid database pool or timeout configuration");
  return n;
}
export function databaseConfig(
  purpose: DatabasePurpose,
  env: Record<string, string | undefined> = process.env,
): PoolConfig {
  const variable = {
    runtime: "DATABASE_URL",
    migration: "MIGRATION_DATABASE_URL",
    email: "EMAIL_DATABASE_URL",
  }[purpose];
  const value = env[variable];
  if (!value) throw new Error(`${variable} is required`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid ${variable}`);
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.hostname ||
    !url.pathname.slice(1)
  )
    throw new Error(`Invalid ${variable}`);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    [...url.searchParams.keys()].some((key) => key !== "sslmode") ||
    url.searchParams.getAll("sslmode").length > 1
  )
    throw new Error(
      "Only sslmode is supported in database URL options; use environment settings for connection configuration",
    );
  const sslmode = url.searchParams.get("sslmode");
  if (sslmode && !["verify-full", "disable"].includes(sslmode))
    throw new Error(
      "Use verified TLS; unsafe or ambiguous sslmode is not accepted",
    );
  if (
    ["sslcert", "sslkey", "sslrootcert", "uselibpqcompat"].some((key) =>
      url.searchParams.has(key),
    )
  )
    throw new Error(
      "Configure database certificates through DATABASE_CA_CERT_FILE",
    );
  if (env.DATABASE_SSL && !["true", "false"].includes(env.DATABASE_SSL))
    throw new Error("DATABASE_SSL must be true or false");
  if (!local && (env.DATABASE_SSL === "false" || sslmode === "disable"))
    throw new Error("Remote database connections require verified TLS");
  if (sslmode === "disable" && env.DATABASE_SSL === "true")
    throw new Error("Conflicting database TLS configuration");
  if (sslmode === "verify-full" && env.DATABASE_SSL === "false")
    throw new Error("Conflicting database TLS configuration");
  const tls =
    !local || env.DATABASE_SSL === "true" || sslmode === "verify-full";
  url.searchParams.delete("sslmode");
  if (purpose === "migration" && url.port === "6543")
    throw new Error(
      "Migrations require a direct or session connection, not a transaction pooler",
    );
  if (env.DATABASE_CA_CERT_FILE && env.DATABASE_CA_PEM)
    throw new Error("Configure only one database CA certificate source");
  const rawCa = env.DATABASE_CA_CERT_FILE
    ? readFileSync(env.DATABASE_CA_CERT_FILE, "utf8")
    : env.DATABASE_CA_PEM;
  const ca = rawCa === undefined ? undefined : normalizeCaPem(rawCa);
  return {
    connectionString: url.toString(),
    ssl: tls ? { rejectUnauthorized: true, ...(ca ? { ca } : {}) } : false,
    max: purpose === "runtime" ? integer(env.DATABASE_POOL_MAX, 5, 1, 30) : 1,
    connectionTimeoutMillis: integer(
      env.DATABASE_CONNECT_TIMEOUT_MS,
      5000,
      100,
      30000,
    ),
    idleTimeoutMillis: 30000,
    statement_timeout: purpose === "migration" ? 60000 : 15000,
    application_name: `staypunch-${purpose}`,
  };
}
