import assert from "node:assert/strict";
import { Client, type PoolClient, type PoolConfig } from "pg";
import { databaseConfig } from "../../lib/database-config";
import { serviceDiagnostic } from "../../lib/service-diagnostics";

export class AppRotationError extends Error {
  constructor(public category: string) {
    super("App password rotation failed; sensitive diagnostics suppressed");
  }
}

export function appVerificationConfig(
  env: Record<string, string | undefined>,
  password: string,
): PoolConfig {
  if (!password || password.length < 24 || password.includes("\0"))
    throw new AppRotationError("rotation_password_policy");
  const operator = databaseConfig("migration", env);
  const url = new URL(operator.connectionString!);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const project = env.SUPABASE_PROJECT_REF;
  if (local) {
    if (env.NODE_ENV === "production")
      throw new AppRotationError("rotation_endpoint");
    url.username = "stay_app";
  } else {
    if (!project || !/^[a-z0-9]{20}$/.test(project))
      throw new AppRotationError("rotation_project_reference");
    if (url.hostname === `db.${project}.supabase.co`) url.username = "stay_app";
    else if (
      /^aws-[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname) &&
      decodeURIComponent(url.username).endsWith(`.${project}`) &&
      (!url.port || url.port === "5432")
    )
      url.username = `stay_app.${project}`;
    else throw new AppRotationError("rotation_endpoint");
  }
  // URL setters preserve literal '%' characters; encode them before pg decodes userinfo.
  url.password = encodeURIComponent(password);
  return databaseConfig("runtime", { ...env, DATABASE_URL: url.toString() });
}

export async function appRoleState(client: PoolClient | Client) {
  const result = await client.query(
    "SELECT to_jsonb(r)-'rolpassword' AS attributes,(SELECT count(*)::integer FROM pg_auth_members m WHERE m.member=r.oid) AS memberships,(SELECT count(*)::integer FROM pg_class c WHERE c.relowner=r.oid) AS owned_objects,(SELECT count(*)::integer FROM pg_namespace n WHERE n.nspowner=r.oid) AS owned_schemas,(SELECT count(*)::integer FROM pg_database d WHERE d.datdba=r.oid) AS owned_databases,(SELECT jsonb_agg(s ORDER BY s.kind,s.name) FROM (SELECT 'relation' AS kind,n.nspname||'.'||c.relname AS name,c.relacl::text AS acl FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','stay_private') UNION ALL SELECT 'schema',nspname,nspacl::text FROM pg_namespace WHERE nspname IN ('public','stay_private') UNION ALL SELECT 'column',n.nspname||'.'||c.relname||'.'||a.attnum::text,a.attacl::text FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','stay_private') AND a.attnum>0 AND NOT a.attisdropped UNION ALL SELECT 'database',datname,datacl::text FROM pg_database WHERE datname=current_database() UNION ALL SELECT 'function',n.nspname||'.'||p.oid::text,p.proacl::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','stay_private')) s) AS application_acls FROM pg_roles r WHERE rolname='stay_app'",
  );
  const state = result.rows[0];
  if (!state) throw new AppRotationError("rotation_role_missing");
  const role = state.attributes;
  if (
    !role.rolcanlogin ||
    role.rolsuper ||
    role.rolcreatedb ||
    role.rolcreaterole ||
    role.rolreplication ||
    role.rolbypassrls ||
    state.memberships ||
    state.owned_objects ||
    state.owned_schemas ||
    state.owned_databases ||
    (role.rolvaliduntil && new Date(role.rolvaliduntil).getTime() <= Date.now())
  )
    throw new AppRotationError("rotation_role_not_restricted");
  return state;
}

export async function rotateAppPassword(client: PoolClient, password: string) {
  if (!password || password.length < 24 || password.includes("\0"))
    throw new AppRotationError("rotation_password_policy");
  await client.query("BEGIN");
  try {
    const before = await appRoleState(client);
    const result = await client.query<{ command: string }>(
      "SELECT format('ALTER ROLE stay_app PASSWORD %L',$1::text) AS command",
      [password],
    );
    await client.query(result.rows[0].command);
    assert.deepEqual(await appRoleState(client), before);
    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* Do not print driver diagnostics. */
    }
    throw new AppRotationError(
      error instanceof AppRotationError
        ? error.category
        : serviceDiagnostic(error),
    );
  }
}

export async function verifyAppPassword(config: PoolConfig) {
  const client = new Client(config);
  try {
    await client.connect();
    assert.equal(
      (await client.query("SELECT current_user AS role")).rows[0].role,
      "stay_app",
    );
    await appRoleState(client);
  } finally {
    await client.end();
  }
}
