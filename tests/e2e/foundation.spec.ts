import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import { hash as passwordHash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
test.describe.configure({ mode: "serial" });
test.setTimeout(120000);
const db = new Pool({ connectionString: process.env.TEST_DATABASE_OWNER_URL });
const base = process.env.TEST_BASE_URL ?? "http://localhost:3100";
const suffix = randomUUID();
const ownerEmail = `owner-${suffix}@example.test`;
const adminEmail = `admin-${suffix}@example.test`;
const secret = `Test-${randomUUID()}!`;
let propertyId: string;
let secondId: string;
test.afterAll(async () => {
  await db.end();
});
async function post(
  context: import("@playwright/test").APIRequestContext,
  path: string,
  data: unknown,
) {
  return context.post(path, { data, headers: { origin: base } });
}
test("public navigation, enquiry persistence, responsive layout and accessibility", async ({
  page,
  request,
}) => {
  for (const path of [
    "/",
    "/features",
    "/channel-manager",
    "/property-management-system",
    "/booking-engine",
    "/revenue-management",
    "/hotel-operations",
    "/integrations",
    "/pricing",
    "/about",
    "/contact",
    "/request-demo",
    "/free-trial",
    "/login",
    "/register",
    "/faq",
    "/blog",
    "/privacy-policy",
    "/terms",
  ]) {
    expect((await request.get(path)).status(), path).toBe(200);
  }
  await page.goto("/");
  await page.getByRole("button", { name: "Rooms", exact: true }).click();
  await expect(page.getByText("Give every room a place")).toBeVisible();
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 950 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `overflow at ${width}`,
    ).toBe(true);
  }
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  const leadEmail = `lead-${suffix}@example.test`;
  expect(
    (
      await post(request, "/api/leads", {
        kind: "demo",
        name: "Test Enquiry",
        email: leadEmail,
        message: "Integration validation only",
      })
    ).status(),
  ).toBe(201);
  expect(
    (await db.query("SELECT count(*) FROM leads WHERE email=$1", [leadEmail]))
      .rows[0].count,
  ).toBe("1");
  expect(
    (
      await post(request, "/api/leads", {
        kind: "demo",
        name: "Bot",
        email: leadEmail,
        website: "spam.invalid",
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/leads", {
        data: { kind: "demo", name: "Forged", email: leadEmail },
        headers: { origin: "https://untrusted.example" },
      })
    ).status(),
  ).toBe(403);
});
test("property onboarding, authorization, invitations, release enforcement and reset", async ({
  playwright,
  page,
}) => {
  const ctx = await playwright.request.newContext({ baseURL: base });
  expect(await (await ctx.get("/app", { maxRedirects: 0 })).text()).toContain(
    "/login",
  );
  expect((await post(ctx, "/api/admin/plans", {})).status()).toBe(401);
  const registration = await post(ctx, "/api/auth/register", {
    name: "Test Property Owner",
    email: ownerEmail,
    password: secret,
    propertyName: "Validation Hotel",
  });
  expect(await registration.json()).toMatchObject({ ok: true });
  expect(registration.headers()["set-cookie"]).toContain("HttpOnly");
  propertyId = (
    await db.query(
      "SELECT p.id FROM properties p JOIN memberships m ON m.property_id=p.id JOIN users u ON u.id=m.user_id WHERE u.email=$1",
      [ownerEmail],
    )
  ).rows[0].id;
  expect(
    (
      await post(ctx, "/api/admin/properties", {
        id: propertyId,
        status: "active",
      })
    ).status(),
  ).toBe(403);
  expect(await (await ctx.get("/admin")).text()).toContain("/app");
  expect(
    (
      await post(ctx, "/api/workspace/property", {
        propertyId,
        name: "Validation Hotel Updated",
        type: "resort",
        email: ownerEmail,
        phone: "",
        address: "Test address",
        amenities: ["WiFi", "Pool"],
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await post(ctx, "/api/workspace/rooms", {
        propertyId,
        name: "Test Suite",
        capacity: 2,
        units: 4,
      })
    ).status(),
  ).toBe(200);
  const outsider = await playwright.request.newContext({ baseURL: base });
  const secondEmail = `second-${suffix}@example.test`;
  expect(
    (
      await post(outsider, "/api/auth/register", {
        name: "Other Owner",
        email: secondEmail,
        password: secret,
        propertyName: "Other Hotel",
      })
    ).status(),
  ).toBe(200);
  secondId = (
    await db.query(
      "SELECT p.id FROM properties p JOIN memberships m ON m.property_id=p.id JOIN users u ON u.id=m.user_id WHERE u.email=$1",
      [secondEmail],
    )
  ).rows[0].id;
  expect(
    (
      await post(ctx, "/api/workspace/rooms", {
        propertyId: secondId,
        name: "Cross tenant",
        capacity: 2,
        units: 1,
      })
    ).status(),
  ).toBe(403);
  for (const id of ["booking-engine", "payments-refunds", "channel-manager"])
    expect(
      (await post(ctx, `/api/modules/${id}`, { propertyId })).status(),
    ).toBe(403);
  const verificationMail = (
    await db.query(
      "SELECT body FROM email_outbox WHERE recipient=$1 AND kind='verification' ORDER BY created_at DESC LIMIT 1",
      [ownerEmail],
    )
  ).rows[0].body;
  expect(
    (
      await post(ctx, "/api/auth/verify-email", {
        token: new URL(verificationMail).searchParams.get("token"),
      })
    ).status(),
  ).toBe(200);
  const staffEmail = `staff-${suffix}@example.test`;
  expect(
    (
      await post(ctx, "/api/workspace/staff", {
        propertyId,
        email: staffEmail,
        role: "staff",
      })
    ).status(),
  ).toBe(200);
  const inviteMail = (
    await db.query("SELECT body FROM email_outbox WHERE recipient=$1", [
      staffEmail,
    ])
  ).rows[0].body;
  const inviteToken = new URL(inviteMail).searchParams.get("token");
  const staff = await playwright.request.newContext({ baseURL: base });
  expect(
    (
      await post(staff, "/api/auth/register-staff", {
        name: "Test Staff",
        email: staffEmail,
        password: secret,
        token: inviteToken,
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await post(staff, "/api/workspace/rooms", {
        propertyId,
        name: "Not allowed",
        capacity: 2,
        units: 1,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await post(staff, "/api/workspace/support", {
        propertyId,
        subject: "Need assistance",
        message: "Testing the support request flow",
        priority: "normal",
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await post(staff, "/api/auth/accept-invite", { token: inviteToken })
    ).status(),
  ).toBe(400);
  await page.context().addCookies((await ctx.storageState()).cookies);
  for (const path of [
    "/app",
    "/app/property",
    "/app/rooms",
    "/app/staff",
    "/app/subscription",
    "/app/modules",
    "/app/support",
    "/app/settings",
  ]) {
    await page.goto(path);
    await expect(page.locator(".workspace-main h1")).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await post(ctx, "/api/auth/reset-request", { email: ownerEmail })
    ).status(),
  ).toBe(200);
  const reset = (
    await db.query(
      "SELECT body FROM email_outbox WHERE recipient=$1 AND subject LIKE 'Reset%' ORDER BY created_at DESC",
      [ownerEmail],
    )
  ).rows[0];
  const resetToken = new URL(reset.body).searchParams.get("token");
  expect(
    (
      await post(ctx, "/api/auth/reset", {
        token: resetToken,
        password: secret + "new",
      })
    ).status(),
  ).toBe(200);
  expect(await (await ctx.get("/app", { maxRedirects: 0 })).text()).toContain(
    "/login",
  );
  expect(
    (
      await post(ctx, "/api/auth/reset", {
        token: resetToken,
        password: secret + "new",
      })
    ).status(),
  ).toBe(400);
  const unknown = `unknown-${suffix}@example.test`;
  for (let i = 0; i < 10; i++)
    expect(
      (
        await post(ctx, "/api/auth/login", {
          email: unknown,
          password: "incorrect",
        })
      ).status(),
    ).toBe(401);
  expect(
    (
      await post(ctx, "/api/auth/login", {
        email: unknown,
        password: "incorrect",
      })
    ).status(),
  ).toBe(429);
  await ctx.dispose();
  await outsider.dispose();
  await staff.dispose();
});
test("super admin management, entitlement gates, suspension and audit records", async ({
  playwright,
  page,
}) => {
  await db.query(
    "INSERT INTO users(email,name,password_hash,platform_role) VALUES($1,'Test Administrator',$2,'super_admin')",
    [adminEmail, await passwordHash(secret, 12)],
  );
  const ctx = await playwright.request.newContext({ baseURL: base });
  expect(
    (
      await post(ctx, "/api/auth/login", {
        email: adminEmail,
        password: secret,
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await post(ctx, "/api/admin/properties", {
        id: propertyId,
        status: "active",
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await post(ctx, "/api/admin/plans", {
        id: "validation",
        name: "Validation Plan",
        price: "",
        currency: "INR",
        trialDays: 7,
        features: "Property setup\nPlanned modules: Coming Soon",
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await post(ctx, "/api/admin/subscriptions", {
        propertyId,
        planId: "validation",
        status: "active",
        renewsAt: null,
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await post(ctx, "/api/admin/modules", {
        id: "booking-engine",
        developmentStatus: "complete",
        releaseState: "released",
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await post(ctx, "/api/admin/entitlements", {
        id: "booking-engine",
        planId: "validation",
        enabled: true,
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await post(ctx, "/api/admin/entitlements", {
        id: "booking-engine",
        propertyId,
        enabled: true,
      })
    ).status(),
  ).toBe(200);
  const customer = await playwright.request.newContext({ baseURL: base });
  expect(
    (
      await post(customer, "/api/auth/login", {
        email: ownerEmail,
        password: secret + "new",
      })
    ).status(),
  ).toBe(200);
  await db.query(
    "UPDATE feature_registry SET release_state='released' WHERE id='booking-engine'",
  );
  try {
    expect(
      (
        await post(customer, "/api/modules/booking-engine", { propertyId })
      ).status(),
    ).toBe(403);
  } finally {
    await db.query(
      "UPDATE feature_registry SET release_state='planned' WHERE id='booking-engine'",
    );
    await customer.dispose();
  }
  const lead = (
    await db.query("SELECT id FROM leads WHERE email=$1", [
      `lead-${suffix}@example.test`,
    ])
  ).rows[0];
  expect(
    (
      await post(ctx, "/api/admin/leads", {
        id: lead.id,
        status: "contacted",
        notes: "Validation follow-up",
        assignedTo: null,
      })
    ).status(),
  ).toBe(200);
  await page.context().addCookies((await ctx.storageState()).cookies);
  for (const path of [
    "/admin",
    "/admin/properties",
    "/admin/customers",
    "/admin/subscriptions",
    "/admin/plans",
    "/admin/modules",
    "/admin/leads",
    "/admin/integrations",
    "/admin/support",
    "/admin/analytics",
    "/admin/settings",
    "/admin/audit",
  ]) {
    await page.goto(path);
    await expect(page.locator(".workspace-main h1")).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    Number(
      (
        await db.query(
          "SELECT count(*) FROM audit_logs WHERE action LIKE 'admin.%'",
        )
      ).rows[0].count,
    ),
  ).toBeGreaterThan(0);
  expect(
    (
      await post(ctx, "/api/admin/properties", {
        id: secondId,
        status: "suspended",
      })
    ).status(),
  ).toBe(200);
  await post(ctx, "/api/auth/logout", {});
  expect(await (await ctx.get("/admin", { maxRedirects: 0 })).text()).toContain(
    "/login",
  );
  await ctx.dispose();
});
