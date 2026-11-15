// Only fixed labels may reach logs. Driver messages can contain credentials or SQL.
const codes = new Map<string, string>([
  ["28P01", "database_authentication"],
  ["28000", "database_authentication"],
  ["3D000", "database_name"],
  ["42501", "database_permissions"],
  ["42P01", "database_schema"],
  ["42703", "database_schema"],
  ["53300", "database_connection_limit"],
  ["57P03", "database_unavailable"],
  ["57014", "database_query_timeout"],
  ["ENOTFOUND", "database_dns"],
  ["EAI_AGAIN", "database_dns"],
  ["ECONNREFUSED", "database_network"],
  ["ENETUNREACH", "database_network"],
  ["ETIMEDOUT", "database_network"],
  ["ECONNRESET", "database_network"],
  ["UNABLE_TO_VERIFY_LEAF_SIGNATURE", "database_ca_trust"],
  ["UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "database_ca_trust"],
  ["SELF_SIGNED_CERT_IN_CHAIN", "database_ca_trust"],
  ["DEPTH_ZERO_SELF_SIGNED_CERT", "database_ca_trust"],
  ["CERT_HAS_EXPIRED", "database_certificate_expired"],
  ["ERR_TLS_CERT_ALTNAME_INVALID", "database_certificate_hostname"],
  ["ENOENT", "server_file_missing"],
]);
const messages = new Map<string, string>([
  ["DATABASE_URL is required", "database_url_missing"],
  ["Invalid DATABASE_URL", "database_url_invalid"],
  ["The configured database CA certificate is missing.", "database_ca_missing"],
  [
    "The configured database CA certificate is not a valid PEM certificate bundle.",
    "database_ca_invalid",
  ],
  ["Configure only one database CA certificate source", "database_ca_conflict"],
  ["DATABASE_SSL must be true or false", "database_ssl_setting"],
  ["Remote database connections require verified TLS", "database_ssl_setting"],
  ["Conflicting database TLS configuration", "database_ssl_setting"],
  [
    "Use verified TLS; unsafe or ambiguous sslmode is not accepted",
    "database_ssl_setting",
  ],
  [
    "Only sslmode is supported in database URL options; use environment settings for connection configuration",
    "database_url_options",
  ],
  ["Invalid database pool or timeout configuration", "database_pool_setting"],
  ["timeout exceeded when trying to connect", "database_connect_timeout"],
  [
    "Connection terminated due to connection timeout",
    "database_connect_timeout",
  ],
]);
export function serviceDiagnostic(error: unknown): string {
  if (!(error instanceof Error)) return "unexpected";
  const code = (error as Error & { code?: unknown }).code;
  return (
    (typeof code === "string" ? codes.get(code) : undefined) ??
    messages.get(error.message) ??
    "unexpected"
  );
}
