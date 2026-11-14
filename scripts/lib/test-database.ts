import type { Client } from "pg";
import { setTimeout } from "node:timers/promises";

/** Only disposable databases created by our local upgrade/restore tests may be dropped. */
export async function dropTestDatabase(
  admin: Pick<Client, "query">,
  name: string,
  timeoutMs = 5000,
) {
  if (!/^staypunch_(upgrade|restore|cleanup)_[a-f0-9]{32}$/.test(name)) {
    throw new Error(
      "Refusing to drop a database outside the disposable test namespace",
    );
  }
  const deadline = performance.now() + timeoutMs;
  for (;;) {
    const result = await admin.query(
      "SELECT count(*)::integer AS connections FROM pg_stat_activity WHERE datname=$1",
      [name],
    );
    if (result.rows[0].connections === 0) break;
    if (performance.now() >= deadline) {
      throw new Error(
        "Temporary database still has active connections; refusing forced cleanup",
      );
    }
    await setTimeout(Math.min(25, Math.max(1, deadline - performance.now())));
  }
  // Deliberately no FORCE: a new/stray connection must fail cleanup, never be terminated.
  await admin.query(`DROP DATABASE "${name}"`);
}
