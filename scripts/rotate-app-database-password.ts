import { Pool, type PoolClient } from "pg";
import { databaseConfig } from "../lib/database-config";
import { serviceDiagnostic } from "../lib/service-diagnostics";
import {
  appVerificationConfig,
  AppRotationError,
  rotateAppPassword,
  verifyAppPassword,
} from "./lib/app-password-rotation";

let pool: Pool | undefined;
let client: PoolClient | undefined;
let committed = false;
try {
  const password = process.env.STAYPUNCH_APP_DATABASE_PASSWORD ?? "";
  const verification = appVerificationConfig(process.env, password);
  pool = new Pool(databaseConfig("migration"));
  client = await pool.connect();
  await rotateAppPassword(client, password);
  committed = true;
  client.release();
  client = undefined;
  console.log(
    "stay_app password rotation committed; grants and role attributes retained.",
  );
  // Retry fresh authentication only, never the ALTER ROLE operation.
  let verified = false;
  let verificationCategory = "unexpected";
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      await verifyAppPassword(verification);
      verified = true;
      break;
    } catch (error) {
      verificationCategory =
        error instanceof AppRotationError
          ? error.category
          : serviceDiagnostic(error);
      if (attempt < 5)
        await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
  if (!verified) throw new AppRotationError(verificationCategory);
  console.log(
    "Fresh stay_app connection verified with the new password and restricted privileges. No other role or application record was changed.",
  );
} catch (error) {
  const category =
    error instanceof AppRotationError
      ? error.category
      : serviceDiagnostic(error);
  console.error(
    committed
      ? `Password rotation COMMITTED, but fresh connection verification failed (${category}). The old password must not be assumed active. Check pooler/configuration privately before any retry.`
      : `Password rotation did not confirm a commit (${category}). Inspect role state before any retry; connection loss can leave commit outcome uncertain.`,
  );
  process.exitCode = 1;
} finally {
  client?.release();
  if (pool) await pool.end();
}
