import assert from "node:assert/strict";
import {
  expect,
  request,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { modules, moduleIsLive } from "../../lib/modules";

export class AdminValidationError extends Error {
  constructor(public stage: string) {
    super(`Admin browser validation failed at ${stage}`);
  }
}

// No screenshots, traces, storage-state files, response bodies or raw errors are published.
export async function validateAdminBrowser(
  browser: Browser,
  input: { origin: string; email: string; password: string },
  report: (summary: string) => void = () => {},
) {
  let stage = "configuration";
  const contexts: BrowserContext[] = [];
  let session: string | undefined;
  const errors = {
    console: 0,
    javascript: 0,
    http: 0,
    network: 0,
    blockedWrites: 0,
    favicon: 0,
  };
  const sections = [
    { label: "Properties", path: "/admin/properties", title: "Properties" },
    { label: "Users", path: "/admin/customers", title: "Customers" },
    {
      label: "Subscriptions",
      path: "/admin/subscriptions",
      title: "Subscriptions",
    },
    { label: "Settings", path: "/admin/settings", title: "Settings" },
  ];
  const sizes = [
    { name: "desktop", width: 1440, height: 1000, touch: false },
    { name: "tablet", width: 768, height: 1024, touch: true },
    { name: "mobile", width: 390, height: 844, touch: true },
  ];
  let desktop: BrowserContext | undefined;
  async function observe(context: BrowserContext, page: Page) {
    context.setDefaultTimeout(15000);
    await context.route("**/*", async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const auth =
        url.origin === input.origin &&
        ["/api/auth/login", "/api/auth/logout"].includes(url.pathname);
      if (
        !["GET", "HEAD", "OPTIONS"].includes(req.method()) &&
        !(req.method() === "POST" && auth)
      ) {
        errors.blockedWrites++;
        await route.abort();
      } else await route.continue();
    });
    page.on("console", (message) => {
      if (message.type() === "error") errors.console++;
    });
    page.on("pageerror", () => errors.javascript++);
    page.on("response", (response) => {
      if (response.status() >= 400) {
        errors.http++;
        if (new URL(response.url()).pathname === "/favicon.ico")
          errors.favicon++;
      }
    });
    page.on("requestfailed", (req) => {
      if (
        req.failure()?.errorText !== "net::ERR_ABORTED" ||
        new URL(req.url()).pathname.startsWith("/api/")
      )
        errors.network++;
    });
  }
  async function layout(page: Page) {
    await expect(page.locator(".workspace-main h1")).toBeVisible();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  try {
    const url = new URL(input.origin);
    assert.equal(url.origin, input.origin);
    assert(
      url.protocol === "https:" ||
        (url.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)),
    );
    assert(input.email && input.password);
    assert.equal(modules.length, 39);
    assert(modules.every((module) => !moduleIsLive(module.id)));
    desktop = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      timezoneId: "Asia/Kolkata",
    });
    contexts.push(desktop);
    const page = await desktop.newPage();
    await observe(desktop, page);
    stage = "browser login and secure cookie";
    await page.goto(`${input.origin}/login`);
    await page.getByLabel("Email address").fill(input.email);
    await page.getByLabel("Password", { exact: true }).fill(input.password);
    await page.getByRole("button", { name: "Sign in →" }).click();
    await expect(page).toHaveURL(`${input.origin}/admin`);
    await layout(page);
    const cookie = (await desktop.cookies()).find(
      (item) => item.name === "stay_session",
    );
    assert(cookie?.httpOnly && cookie.sameSite === "Lax");
    if (url.protocol === "https:") assert(cookie.secure);
    session = cookie.value;
    const state = await desktop.storageState(); // Memory only; never written to an artifact.
    await page.goto(`${input.origin}/login`);
    await expect(page).toHaveURL(`${input.origin}/admin`);
    report("PASS browser login, signed-in redirect and session cookie flags");

    for (const size of sizes) {
      stage = `${size.name} navigation and layout`;
      const context: BrowserContext = size.touch
        ? await browser.newContext({
            viewport: { width: size.width, height: size.height },
            isMobile: true,
            hasTouch: true,
            storageState: state,
            timezoneId: "Asia/Kolkata",
          })
        : desktop;
      if (size.touch) contexts.push(context);
      const current: Page = size.touch ? await context.newPage() : page;
      if (size.touch) await observe(context, current);
      await current.goto(`${input.origin}/admin`);
      await layout(current);
      assert.equal(await current.evaluate(() => innerWidth), size.width);
      for (const section of sections) {
        stage = `${size.name} navigation ${section.label}`;
        const link = current
          .getByRole("navigation", { name: "Administration", exact: true })
          .getByRole("link", { name: section.label, exact: true });
        if (size.touch) await link.tap();
        else await link.click();
        await expect(current).toHaveURL(`${input.origin}${section.path}`);
        await expect(current.locator(".workspace-main h1")).toHaveText(
          section.title,
        );
        await layout(current);
        await expect(
          current.getByRole("button", { name: "Sign out", exact: true }),
        ).toBeVisible();
        report(`PASS ${size.name} navigation ${section.label}`);
      }
      stage = `${size.name} module catalogue`;
      await current
        .getByRole("navigation", { name: "Administration", exact: true })
        .getByRole("link", { name: "Modules", exact: true })
        .click();
      await expect(current).toHaveURL(`${input.origin}/admin/modules`);
      await layout(current);
      for (const plannedModule of modules)
        await expect(
          current.locator(`[id="${plannedModule.id}"] .badge`),
        ).toHaveText("Coming Soon");
      await current.locator(".roadmap-navigation > summary").click();
      const planned = current.getByRole("navigation", {
        name: "Planned modules",
        exact: true,
      });
      for (const group of new Set(modules.map((module) => module.group)))
        await planned.getByText(group, { exact: true }).click();
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
      await expect(current).toHaveURL(
        `${input.origin}/admin/modules#booking-engine`,
      );
      await expect(current.locator("#booking-engine")).toBeInViewport();
      stage = `${size.name} disabled OTA controls`;
      await current
        .getByRole("navigation", { name: "Administration", exact: true })
        .getByRole("link", { name: "Integrations", exact: true })
        .click();
      await expect(current).toHaveURL(`${input.origin}/admin/integrations`);
      await expect(
        current.getByText("OTA connections and synchronization are disabled.", {
          exact: false,
        }),
      ).toBeVisible();
      const connect = current.getByRole("button", {
        name: "Connect provider",
        exact: true,
      });
      assert((await connect.count()) > 0);
      for (const button of await connect.all())
        await expect(button).toBeDisabled();
      await layout(current);
      report(
        `PASS ${size.name} ${size.width}x${size.height}: four sections, 39 Coming Soon modules and disabled OTA controls`,
      );
      if (size.touch) await context.close();
    }

    stage = "read-only API and authorization checks";
    const account = await desktop.request.get(
      `${input.origin}/api/account/sessions`,
    );
    assert.equal(account.status(), 200);
    assert.equal(account.headers()["cache-control"], "private, no-store");
    const body = await account.json();
    assert(Array.isArray(body.sessions));
    assert(
      body.sessions.every((item: Record<string, unknown>) =>
        Object.keys(item).every((key) =>
          ["id", "created_at", "expires_at"].includes(key),
        ),
      ),
    );
    const anonymous = await request.newContext({
      baseURL: input.origin,
      extraHTTPHeaders: { origin: input.origin },
    });
    try {
      for (const resource of [
        "properties",
        "customers",
        "subscriptions",
        "settings",
      ])
        assert.equal(
          (
            await anonymous.post(`/api/admin/${resource}`, { data: {} })
          ).status(),
          401,
        );
      assert.equal(
        (await anonymous.get("/api/account/sessions")).status(),
        401,
      );
      assert.equal(
        (
          await desktop.request.post(`${input.origin}/api/admin/properties`, {
            data: {},
            headers: { origin: "https://untrusted.example" },
          })
        ).status(),
        403,
      );
      // These handlers only read permissions/release state and have no transaction implementation.
      for (const id of [
        "booking-engine",
        "payments-refunds",
        "channel-manager",
      ])
        assert.equal(
          (
            await desktop.request.post(`${input.origin}/api/modules/${id}`, {
              data: { propertyId: "00000000-0000-4000-8000-000000000000" },
              headers: { origin: input.origin },
            })
          ).status(),
          403,
        );
    } finally {
      await anonymous.dispose();
    }
    report(
      "PASS session API privacy, anonymous denials, CSRF denial and three disabled operational endpoints (no property membership assumed)",
    );

    stage = "logout and replay denial";
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(`${input.origin}/login`);
    for (const path of ["/admin", ...sections.map((section) => section.path)]) {
      await page.goto(`${input.origin}${path}`);
      await expect(page).toHaveURL(`${input.origin}/login`);
    }
    const replay = await request.newContext({
      baseURL: input.origin,
      extraHTTPHeaders: {
        origin: input.origin,
        cookie: `stay_session=${session}`,
      },
    });
    try {
      assert.equal(
        (await replay.post("/api/admin/properties", { data: {} })).status(),
        401,
      );
    } finally {
      await replay.dispose();
    }
    session = undefined;
    report(
      "PASS logout, protected-page redirect and server-side session replay denial",
    );
    stage = "browser diagnostics";
    report(`Browser diagnostics: ${JSON.stringify(errors)}`);
    assert(Object.values(errors).every((count) => count === 0));
    return {
      sections: sections.length,
      viewports: sizes.length,
      comingSoonModules: modules.length,
      errors,
    };
  } catch {
    throw new AdminValidationError(stage);
  } finally {
    if (session && desktop) {
      try {
        await desktop.request.post(`${input.origin}/api/auth/logout`, {
          data: {},
          headers: { origin: input.origin },
        });
      } catch {
        /* Do not print sensitive driver details. */
      }
    }
    for (const context of contexts) {
      try {
        await context.close();
      } catch {
        /* Already closed. */
      }
    }
  }
}
