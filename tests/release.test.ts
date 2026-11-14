import { test } from "node:test";
import assert from "node:assert/strict";
import { canUseModule, modules } from "../lib/modules";
import { registration, leadSchema, roomSchema } from "../lib/validation";
test("an admin release toggle and entitlements cannot activate any unapproved module", () => {
  for (const m of modules)
    assert.equal(
      canUseModule({
        id: m.id,
        releaseState: "released",
        planEnabled: true,
        propertyEnabled: true,
        permissions: ["modules.use"],
      }),
      false,
    );
});
test("roadmap retains legacy modules and includes the requested foundation catalogue", () => {
  for (const name of [
    "Corporate Ledger",
    "Marketing & Reviews",
    "Rate Shopping",
    "Inventory Management",
    "Dynamic Pricing",
    "AI Chatbot",
  ])
    assert.ok(modules.some((m) => m.name === name));
  assert.equal(new Set(modules.map((m) => m.id)).size, modules.length);
});
test("registration rejects weak and over-byte-limit passwords and honeypot bots", () => {
  const input = {
    name: "Test Owner",
    email: "owner@example.test",
    propertyName: "Test Hotel",
    password: "strong-test-password",
  };
  assert.ok(registration.safeParse(input).success);
  assert.ok(!registration.safeParse({ ...input, password: "short" }).success);
  assert.ok(
    !registration.safeParse({ ...input, password: "😀".repeat(25) }).success,
  );
  assert.ok(
    !registration.safeParse({ ...input, website: "bot.example" }).success,
  );
});
test("lead and room validation reject malformed input", () => {
  assert.ok(
    !leadSchema.safeParse({ kind: "demo", name: "A", email: "invalid" })
      .success,
  );
  assert.ok(
    !roomSchema.safeParse({ name: "Suite", capacity: 0, units: -1 }).success,
  );
});
