import { test } from "node:test";
import assert from "node:assert/strict";
import { validRequestOrigin } from "../lib/request-origin";
const request = (origin?: string, forwarded = "https://evil.example") =>
  new Request("http://localhost:3000/api/auth/login", {
    headers: { ...(origin ? { origin } : {}), "x-forwarded-host": forwarded },
  });
test("HTTPS public origins work through a reverse proxy without trusting forwarded hosts", () => {
  const env = {
    NODE_ENV: "production",
    APP_URL: "https://stay.example",
    APP_ALLOWED_ORIGINS: "https://admin.stay.example",
  };
  assert.equal(validRequestOrigin(request("https://stay.example"), env), true);
  assert.equal(
    validRequestOrigin(request("https://admin.stay.example"), env),
    true,
  );
  for (const origin of [
    undefined,
    "null",
    "http://stay.example",
    "https://evil.example",
    "https://stay.example.evil.example",
  ])
    assert.equal(validRequestOrigin(request(origin), env), false);
  assert.equal(
    validRequestOrigin(request("https://evil.example"), {
      NODE_ENV: "production",
    }),
    false,
  );
  assert.equal(
    validRequestOrigin(request("http://stay.example"), {
      NODE_ENV: "production",
      APP_URL: "http://stay.example",
    }),
    false,
  );
});
test("local development allows only the request origin when no public origin is configured", () => {
  assert.equal(
    validRequestOrigin(request("http://localhost:3000"), {
      NODE_ENV: "production",
      APP_URL: "http://localhost:3000",
    }),
    true,
  );
  assert.equal(validRequestOrigin(request("http://localhost:3000"), {}), true);
  assert.equal(validRequestOrigin(request("https://evil.example"), {}), false);
});
