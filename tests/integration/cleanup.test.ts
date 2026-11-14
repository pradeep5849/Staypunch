import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { dropTestDatabase } from "../../scripts/lib/test-database";

function ownerURL() {
  assert.ok(
    process.env.TEST_DATABASE_OWNER_URL,
    "Disposable test owner URL required",
  );
  const url = new URL(process.env.TEST_DATABASE_OWNER_URL);
  assert.ok(
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && !url.search,
  );
  return url;
}

test("cleanup refuses invalid names and never force-terminates an open database connection", async () => {
  const url = ownerURL();
  const admin = new Client({ connectionString: url.toString() });
  const name = `staypunch_cleanup_${randomUUID().replaceAll("-", "")}`;
  let created = false;
  try {
    await admin.connect();
    await assert.rejects(
      dropTestDatabase(admin, "staypunch"),
      /Refusing to drop/,
    );
    await admin.query(`CREATE DATABASE "${name}"`);
    created = true;
    const targetURL = new URL(url);
    targetURL.pathname = `/${name}`;
    const target = new Client({ connectionString: targetURL.toString() });
    try {
      await target.connect();
      await assert.rejects(
        dropTestDatabase(admin, name, 100),
        /still has active connections/,
      );
      assert.equal((await target.query("SELECT 1 AS alive")).rows[0].alive, 1);
    } finally {
      await target.end();
    }
  } finally {
    try {
      if (created) await dropTestDatabase(admin, name);
    } finally {
      await admin.end();
    }
  }
});

test("concurrent temporary database cleanup waits for acknowledged client shutdown", async () => {
  const url = ownerURL();
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      const admin = new Client({ connectionString: url.toString() });
      const name = `staypunch_cleanup_${randomUUID().replaceAll("-", "")}`;
      let created = false;
      try {
        await admin.connect();
        await admin.query(`CREATE DATABASE "${name}"`);
        created = true;
        const targetURL = new URL(url);
        targetURL.pathname = `/${name}`;
        const target = new Client({ connectionString: targetURL.toString() });
        try {
          await target.connect();
          await target.query("SELECT 1");
        } finally {
          await target.end();
        }
        await dropTestDatabase(admin, name);
        created = false;
        assert.equal(
          (
            await admin.query(
              "SELECT count(*)::integer AS total FROM pg_database WHERE datname=$1",
              [name],
            )
          ).rows[0].total,
          0,
        );
      } finally {
        try {
          if (created) await dropTestDatabase(admin, name);
        } finally {
          await admin.end();
        }
      }
    }),
  );
});
