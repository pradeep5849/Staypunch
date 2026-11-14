import { Pool } from "pg";
import { databaseConfig } from "../lib/database-config";
import { webhookProvider } from "../lib/email/provider";
import { deliverOne } from "../lib/email/worker";
const provider = webhookProvider();
const pool = new Pool(databaseConfig("email"));
try {
  let processed = 0;
  for (; processed < 50; processed++)
    if (!(await deliverOne(pool, provider))) break;
  console.log(
    `Email batch processed: ${processed}. Check queue states for provider acceptance or retry outcomes.`,
  );
} finally {
  await pool.end();
}
