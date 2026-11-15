import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { validateAdminBrowser } from "../../scripts/lib/admin-browser-validation";
test("production browser validation harness remains read-only against a disposable admin", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const db = new Pool({
    connectionString: process.env.TEST_DATABASE_OWNER_URL,
  });
  const email = `validation-${randomUUID()}@example.test`,
    password = `Test-${randomUUID()}!`;
  async function snapshot() {
    const tables = await db.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN ('sessions','rate_limits','audit_logs') ORDER BY tablename",
    );
    const state: Record<string, unknown> = {};
    for (const { tablename } of tables.rows) {
      expect(/^[a-z_][a-z0-9_]*$/.test(tablename)).toBe(true);
      state[tablename] = (
        await db.query(
          `SELECT count(*)::text AS count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' ORDER BY md5(to_jsonb(t)::text)),'')) AS fingerprint FROM public."${tablename}" t`,
        )
      ).rows[0];
    }
    return state;
  }
  try {
    await db.query(
      "INSERT INTO users(email,name,password_hash,platform_role) VALUES($1,'Validation Administrator',$2,'super_admin')",
      [email, await hash(password, 12)],
    );
    const before = await snapshot();
    const result = await validateAdminBrowser(
      browser,
      {
        origin: process.env.TEST_BASE_URL ?? "http://localhost:3100",
        email,
        password,
      },
      (message) => console.log(message),
    );
    expect(result).toMatchObject({
      sections: 4,
      viewports: 3,
      comingSoonModules: 39,
    });
    expect(await snapshot()).toEqual(before);
  } finally {
    await db.end();
  }
});
