import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { modules, approvedReleases } from "../lib/modules";
test("approved scope remains exactly 39 Coming Soon modules and 146 traceable requirements", () => {
  const roadmap = JSON.parse(
    readFileSync("docs/planning/module-roadmap.json", "utf8"),
  );
  const register = JSON.parse(
    readFileSync("docs/planning/requirements-register.json", "utf8"),
  );
  assert.equal(modules.length, 39);
  assert.equal(roadmap.length, 39);
  assert.equal(register.length, 146);
  assert.equal(new Set(register.map((r: { id: string }) => r.id)).size, 146);
  assert.deepEqual(
    roadmap.map((m: { id: string; name: string; category: string }) => [
      m.id,
      m.name,
      m.category,
    ]),
    modules.map((m) => [m.id, m.name, m.group]),
  );
  assert.ok(modules.every((m) => m.status === "coming_soon"));
  assert.deepEqual(Object.keys(approvedReleases), []);
  for (const r of register) {
    assert.ok(r.owner && r.acceptance && r.auditStatus);
    assert.ok(r.modules.length);
    for (const id of r.modules) assert.ok(modules.some((m) => m.id === id));
  }
});
