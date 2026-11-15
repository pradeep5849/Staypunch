import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
test("reset responses and throttling do not reveal account existence", async ({
  request,
}) => {
  const db = new Pool({
    connectionString: process.env.TEST_DATABASE_OWNER_URL,
  });
  const known = `known-${randomUUID()}@example.test`,
    unknown = `unknown-${randomUUID()}@example.test`;
  const origin = process.env.TEST_BASE_URL ?? "http://localhost:3100";
  try {
    await db.query(
      "INSERT INTO users(email,name,password_hash) VALUES($1,'Reset fixture','synthetic-hash')",
      [known],
    );
    for (let attempt = 0; attempt < 3; attempt++) {
      const a = await request.post("/api/auth/reset-request", {
        data: { email: known },
        headers: { origin },
      });
      const b = await request.post("/api/auth/reset-request", {
        data: { email: unknown },
        headers: { origin },
      });
      expect(a.status()).toBe(200);
      expect(b.status()).toBe(200);
      expect(await a.json()).toEqual(await b.json());
    }
    for (const email of [known, unknown])
      expect(
        (
          await request.post("/api/auth/reset-request", {
            data: { email },
            headers: { origin },
          })
        ).status(),
      ).toBe(429);
    expect(
      (
        await db.query(
          "SELECT count(*) AS n FROM email_outbox WHERE recipient=$1",
          [unknown],
        )
      ).rows[0].n,
    ).toBe("0");
    expect(
      (
        await db.query(
          "SELECT count(*) AS n FROM auth_tokens t JOIN users u ON u.id=t.user_id WHERE u.email=$1 AND purpose='reset'",
          [known],
        )
      ).rows[0].n,
    ).toBe("1");
  } finally {
    await db.end();
  }
});
