// Protected operator smoke test. Never prints credentials, cookies, response bodies or records.
import assert from "node:assert/strict";
const origin = process.env.ADMIN_CHECK_URL;
const email = process.env.ADMIN_CHECK_EMAIL;
const password = process.env.ADMIN_CHECK_PASSWORD;
let cookie;
async function post(path, body, session = cookie) {
  return fetch(new URL(path, origin), {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/json",
      origin,
      ...(session ? { cookie: session } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
}
try {
  assert(
    origin &&
      new URL(origin).origin === origin &&
      origin.startsWith("https://"),
  );
  const loginPage = await fetch(`${origin}/login`, {
    redirect: "manual",
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(loginPage.status, 200);
  console.log("Public HTTPS login page reachable.");
  assert(email && password, "Operator login check secret is missing.");
  const login = await post("/api/auth/login", { email, password });
  assert.equal(
    login.status,
    200,
    "Login unavailable; verify runtime connection, grants and public origin configuration.",
  );
  const sessionHeader = login.headers
    .getSetCookie()
    .find((value) => value.startsWith("stay_session="));
  assert(
    sessionHeader &&
      /; HttpOnly/i.test(sessionHeader) &&
      /; Secure/i.test(sessionHeader) &&
      /; SameSite=Lax/i.test(sessionHeader),
  );
  cookie = sessionHeader.split(";")[0];
  assert.equal((await login.json()).redirect, "/admin");
  for (const path of [
    "/admin",
    "/admin/properties",
    "/admin/customers",
    "/admin/subscriptions",
    "/admin/settings",
    "/admin/modules",
  ]) {
    const response = await fetch(`${origin}${path}`, {
      headers: { cookie },
      redirect: "manual",
      signal: AbortSignal.timeout(30000),
    });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert(
      html.includes('class="workspace-main"') &&
        !html.includes("NEXT_REDIRECT"),
    );
  }
  assert.equal((await post("/api/auth/logout", {})).status, 200);
  assert.equal((await post("/api/admin/properties", {})).status, 401);
  cookie = undefined;
  console.log(
    "Super Admin login, secure cookie, dashboard sections and logout revocation passed.",
  );
} catch {
  console.error(
    "Admin readiness check failed. Check Hostinger runtime variables, restricted database grants and the existing protected password secret. No account or password was changed.",
  );
  process.exitCode = 1;
} finally {
  if (cookie) {
    try {
      await post("/api/auth/logout", {});
    } catch {
      /* Session expires normally if the server is unavailable. */
    }
  }
}
