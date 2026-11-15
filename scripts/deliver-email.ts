import { Pool } from "pg";
import { databaseConfig } from "../lib/database-config";
import {
  sendingEnabled,
  configuredProvider,
  emailLimits,
} from "../lib/email/config";
import { deliverOne } from "../lib/email/worker";
if (!sendingEnabled()) {
  console.log("Email sending disabled. No database or SMTP connection opened.");
} else {
  let pool: Pool | undefined;
  let provider: ReturnType<typeof configuredProvider> | undefined;
  try {
    provider = configuredProvider();
    const limits = emailLimits();
    // Authenticate before touching queued rows; bad credentials must not exhaust the queue.
    await provider.verify?.();
    pool = new Pool(databaseConfig("email"));
    let processed = 0;
    for (; processed < limits.batchSize; processed++)
      if (!(await deliverOne(pool, provider, limits.maxPerMinute))) break;
    console.log(
      `Email batch processed: ${processed}. Provider acceptance is not inbox confirmation.`,
    );
  } catch {
    console.error(
      "Email worker failed; inspect fixed queue error codes and private configuration. No message data or credentials logged.",
    );
    process.exitCode = 1;
  } finally {
    provider?.close?.();
    await pool?.end();
  }
}
