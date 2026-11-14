import { Pool } from "pg";
import { databaseConfig } from "../lib/database-config";
const pool = new Pool(databaseConfig("runtime"));
try {
  const db = await pool.connect();
  try {
    const role = (
      await db.query(
        "SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user",
      )
    ).rows[0];
    if (role.rolsuper || role.rolbypassrls)
      throw new Error("Runtime role must not be superuser or bypass RLS");
    const owner = (
      await db.query(
        "SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','stay_private') AND c.relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user) LIMIT 1",
      )
    ).rowCount;
    if (owner) throw new Error("Runtime role must not own application objects");
    const tables = (
      await db.query(
        "SELECT c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relname IN ('users','sessions','auth_tokens','organizations','properties','memberships','room_types','rooms','amenities','subscriptions','support_tickets','ticket_messages','email_outbox','auth_factors','schema_migrations')",
      )
    ).rows;
    if (tables.length !== 15 || tables.some((t) => !t.relrowsecurity))
      throw new Error("Required tables or RLS protections are missing");
    for (const role of ["anon", "authenticated", "service_role"]) {
      if (
        !(await db.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [role]))
          .rowCount
      )
        continue;
      const exposed = await db.query(
        "SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relname=ANY($2::text[]) AND has_table_privilege($1,c.oid,'SELECT,INSERT,UPDATE,DELETE') LIMIT 1",
        [role, tables.map((t) => t.relname)],
      );
      if (exposed.rowCount)
        throw new Error("A Data API role has application table privileges");
    }
    const functions = (
      await db.query(
        "SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef AND p.proname IN ('is_platform_admin','has_property_access','accept_staff_invitation')",
      )
    ).rows;
    if (functions.length)
      throw new Error("Privileged helpers must not be in the exposed schema");
    console.log(
      "Database readiness checks passed. This checks the configured PostgreSQL boundary, not production hosting or email delivery.",
    );
  } finally {
    db.release();
  }
} finally {
  await pool.end();
}
