import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import { hash as passwordHash } from "bcryptjs";
import { createHash, randomUUID } from "node:crypto";
import { modules } from "../../lib/modules";
const db = new Pool({ connectionString: process.env.TEST_DATABASE_OWNER_URL });
const base = process.env.TEST_BASE_URL ?? "http://localhost:3100";
test.afterAll(() => db.end());
test("admin sign-in, complete navigation, expiry, revocation and role enforcement", async ({
  page,
  playwright,
}) => {
  const email = `admin-readiness-${randomUUID()}@example.test`;
  const password = `Test-${randomUUID()}!`;
  const {
    rows: [user],
  } = await db.query(
    "INSERT INTO users(email,name,password_hash,platform_role) VALUES($1,'Readiness Admin',$2,'super_admin') RETURNING id",
    [email, await passwordHash(password, 12)],
  );
  const post = (
    context: import("@playwright/test").APIRequestContext,
    path: string,
    data: unknown,
  ) => context.post(path, { data, headers: { origin: base } });
  const anonymous = await playwright.request.newContext({ baseURL: base });
  expect((await post(anonymous, "/api/admin/properties", {})).status()).toBe(
    401,
  );
  expect(
    (
      await post(anonymous, "/api/auth/login", { email, password: "incorrect" })
    ).status(),
  ).toBe(401);
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in →" }).click();
  await expect(page).toHaveURL(`${base}/admin`);
  await expect(page.locator(".workspace-main h1")).toBeVisible();
  await page.goto("/login");
  await expect(page).toHaveURL(`${base}/admin`);
  const cookie = (await page.context().cookies()).find(
    (c) => c.name === "stay_session",
  )!;
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.secure).toBe(true);
  expect(cookie.sameSite).toBe("Lax");
  await page.locator(".roadmap-navigation > summary").click();
  for (const group of new Set(modules.map((m) => m.group)))
    await page
      .getByRole("navigation", { name: "Planned modules" })
      .getByText(group, { exact: true })
      .click();
  const planned = page.getByRole("navigation", { name: "Planned modules" });
  await expect(planned.getByRole("link")).toHaveCount(39);
  for (const plannedModule of modules)
    await expect(
      planned.getByRole("link", {
        name: `${plannedModule.name} Coming Soon`,
        exact: true,
      }),
    ).toBeVisible();
  await planned
    .getByRole("link", { name: "Booking Engine Coming Soon", exact: true })
    .click();
  await expect(page).toHaveURL(`${base}/admin/modules#booking-engine`);
  await expect(page.locator("#booking-engine")).toContainText("Coming Soon");
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  const replay = await playwright.request.newContext({
    baseURL: base,
    extraHTTPHeaders: { cookie: `stay_session=${cookie.value}` },
  });
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(`${base}/login`);
  expect((await post(replay, "/api/admin/properties", {})).status()).toBe(401);
  const context = await playwright.request.newContext({ baseURL: base });
  const login = await post(context, "/api/auth/login", { email, password });
  expect(await login.json()).toMatchObject({ redirect: "/admin" });
  const session = (await context.storageState()).cookies.find(
    (c) => c.name === "stay_session",
  )!;
  await db.query(
    "UPDATE sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1",
    [createHash("sha256").update(session.value).digest("hex")],
  );
  expect((await post(context, "/api/admin/properties", {})).status()).toBe(401);
  await db.query("UPDATE users SET platform_role='customer' WHERE id=$1", [
    user.id,
  ]);
  expect(
    await (await post(context, "/api/auth/login", { email, password })).json(),
  ).toMatchObject({ redirect: "/app" });
  expect((await post(context, "/api/admin/properties", {})).status()).toBe(403);
  await db.query("UPDATE users SET status='suspended' WHERE id=$1", [user.id]);
  expect(
    (await post(context, "/api/auth/login", { email, password })).status(),
  ).toBe(401);
  await anonymous.dispose();
  await replay.dispose();
  await context.dispose();
});
