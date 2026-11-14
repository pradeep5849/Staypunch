import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
const owner = new Pool({
  connectionString: process.env.TEST_DATABASE_OWNER_URL,
});
const app = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
after(async () => {
  await owner.end();
  await app.end();
});
test("runtime role is restricted and tenant RLS blocks cross-property reads and writes", async () => {
  assert.ok(
    process.env.TEST_DATABASE_URL && process.env.TEST_DATABASE_OWNER_URL,
    "Test database URLs required",
  );
  const role = (
    await app.query(
      "SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user",
    )
  ).rows[0];
  assert.equal(role.rolsuper, false);
  assert.equal(role.rolbypassrls, false);
  const [a, b, orgA, orgB, pA, pB] = Array.from({ length: 6 }, () =>
    randomUUID(),
  );
  const suffix = randomUUID();
  await owner.query(
    "INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,'Tenant A','test'),($3,$4,'Tenant B','test')",
    [a, `a-${suffix}@test.invalid`, b, `b-${suffix}@test.invalid`],
  );
  await owner.query(
    "INSERT INTO organizations(id,name,owner_id) VALUES($1,'A',$2),($3,'B',$4)",
    [orgA, a, orgB, b],
  );
  await owner.query(
    "INSERT INTO properties(id,organization_id,name) VALUES($1,$2,'A'),($3,$4,'B')",
    [pA, orgA, pB, orgB],
  );
  await owner.query(
    "INSERT INTO memberships VALUES($1,$2,'owner',now()),($3,$4,'owner',now())",
    [pA, a, pB, b],
  );
  const db = await app.connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT set_config('app.user_id',$1,true)", [a]);
    const rows = (await db.query("SELECT id FROM properties")).rows;
    assert.ok(rows.some((r) => r.id === pA));
    assert.ok(!rows.some((r) => r.id === pB));
    assert.equal(
      (await db.query("UPDATE properties SET name='hacked' WHERE id=$1", [pB]))
        .rowCount,
      0,
    );
    await assert.rejects(
      db.query(
        "INSERT INTO room_types(property_id,name,capacity,units) VALUES($1,'Injected',2,1)",
        [pB],
      ),
      /row-level security/,
    );
    await db.query("ROLLBACK");
  } finally {
    db.release();
  }
});
test("database disallows accidental live OTA connections", async () => {
  await assert.rejects(
    owner.query("UPDATE ota_providers SET enabled=true WHERE id='airbnb'"),
    /check constraint/,
  );
});
