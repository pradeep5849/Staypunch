import { test, expect, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
const owner = new Pool({
  connectionString: process.env.TEST_DATABASE_OWNER_URL,
});
const base = process.env.TEST_BASE_URL ?? "http://localhost:3100";
test.afterAll(async () => {
  await owner.end();
});
async function post(ctx: APIRequestContext, path: string, data: unknown) {
  return ctx.post(path, { data, headers: { origin: base } });
}
test("verification is single use, expires safely, resends only to self and keeps setup available", async ({
  playwright,
  page,
}) => {
  const suffix = randomUUID();
  const address = `verify-${suffix}@example.test`;
  const secret = randomUUID() + "!";
  const ctx = await playwright.request.newContext({ baseURL: base });
  expect(
    (
      await post(ctx, "/api/auth/register", {
        name: "Verification Test Owner",
        email: address,
        password: secret,
        propertyName: "Verification Test Hotel",
      })
    ).status(),
  ).toBe(200);
  const user = (
    await owner.query("SELECT id,email_verified_at FROM users WHERE email=$1", [
      address,
    ])
  ).rows[0];
  expect(user.email_verified_at).toBeNull();
  const pid = (
    await owner.query("SELECT property_id FROM memberships WHERE user_id=$1", [
      user.id,
    ])
  ).rows[0].property_id;
  expect(
    (
      await post(ctx, "/api/workspace/rooms", {
        propertyId: pid,
        name: "Before verification",
        capacity: 2,
        units: 1,
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await post(ctx, "/api/workspace/staff", {
        propertyId: pid,
        email: "staff@example.test",
        role: "staff",
      })
    ).status(),
  ).toBe(403);
  let mail = (
    await owner.query(
      "SELECT body FROM email_outbox WHERE recipient=$1 AND kind='verification' ORDER BY created_at DESC LIMIT 1",
      [address],
    )
  ).rows[0];
  const old = new URL(mail.body).searchParams.get("token");
  await owner.query(
    "UPDATE auth_tokens SET expires_at=now()-interval '1 second' WHERE user_id=$1 AND purpose='verify'",
    [user.id],
  );
  expect(
    (await post(ctx, "/api/auth/verify-email", { token: old })).status(),
  ).toBe(400);
  expect(
    (
      await post(ctx, "/api/auth/verify-request", {
        email: "unrelated@example.test",
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await owner.query(
        "SELECT count(*) total FROM email_outbox WHERE recipient='unrelated@example.test' AND kind='verification'",
      )
    ).rows[0].total,
  ).toBe("0");
  mail = (
    await owner.query(
      "SELECT body FROM email_outbox WHERE recipient=$1 AND kind='verification' ORDER BY created_at DESC LIMIT 1",
      [address],
    )
  ).rows[0];
  const fresh = new URL(mail.body).searchParams.get("token");
  expect(fresh).not.toBe(old);
  await page.goto(`/verify-email?token=${fresh}`);
  expect(
    (
      await owner.query("SELECT email_verified_at FROM users WHERE id=$1", [
        user.id,
      ])
    ).rows[0].email_verified_at,
  ).toBeNull();
  await page.getByRole("button", { name: "Verify my email" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Your email is verified",
  );
  expect(
    (await post(ctx, "/api/auth/verify-email", { token: fresh })).status(),
  ).toBe(400);
  expect(
    (
      await owner.query("SELECT email_verified_at FROM users WHERE id=$1", [
        user.id,
      ])
    ).rows[0].email_verified_at,
  ).not.toBeNull();
  await ctx.dispose();
});
test("session review and revocation are tenant-safe, immediate and do not expose bearer hashes", async ({
  playwright,
}) => {
  const suffix = randomUUID();
  const password = randomUUID() + "!";
  const a = await playwright.request.newContext({ baseURL: base });
  const b = await playwright.request.newContext({ baseURL: base });
  const other = await playwright.request.newContext({ baseURL: base });
  const email = `sessions-${suffix}@example.test`;
  expect(
    (
      await post(a, "/api/auth/register", {
        name: "Session Test Owner",
        email,
        password,
        propertyName: "Session Test Hotel",
      })
    ).status(),
  ).toBe(200);
  const first = await (await a.get("/api/account/sessions")).json();
  expect(first.sessions).toHaveLength(1);
  expect(JSON.stringify(first)).not.toContain("token_hash");
  expect(Object.keys(first.sessions[0]).sort()).toEqual([
    "created_at",
    "expires_at",
    "id",
  ]);
  expect((await post(b, "/api/auth/login", { email, password })).status()).toBe(
    200,
  );
  expect(
    (
      await post(other, "/api/auth/register", {
        name: "Other Session Owner",
        email: `other-session-${suffix}@example.test`,
        password,
        propertyName: "Other Session Hotel",
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await post(other, "/api/auth/revoke-session", {
        id: first.sessions[0].id,
      })
    ).status(),
  ).toBe(404);
  expect((await a.get("/api/account/sessions")).status()).toBe(200);
  expect(
    (
      await b.post("/api/auth/revoke-sessions", {
        data: {},
        headers: { origin: "https://untrusted.example" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await post(b, "/api/auth/revoke-session", { id: first.sessions[0].id })
    ).status(),
  ).toBe(200);
  expect((await a.get("/api/account/sessions")).status()).toBe(401);
  expect((await b.get("/api/account/sessions")).status()).toBe(200);
  expect((await post(b, "/api/auth/revoke-sessions", {})).status()).toBe(200);
  expect((await b.get("/api/account/sessions")).status()).toBe(401);
  expect((await other.get("/api/account/sessions")).status()).toBe(200);
  await a.dispose();
  await b.dispose();
  await other.dispose();
});
