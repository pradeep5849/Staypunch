import { databaseConfig } from "../lib/database-config";
import { Pool } from "pg";
import { hash } from "bcryptjs";
import { email, password } from "../lib/validation";
const address = email.parse(process.env.BOOTSTRAP_ADMIN_EMAIL);
const secret = password.parse(process.env.BOOTSTRAP_ADMIN_PASSWORD);
const pool = new Pool(databaseConfig("migration"));
try {
  const result = await pool.query(
    "INSERT INTO users(email,name,password_hash,platform_role) VALUES($1,'Platform administrator',$2,'super_admin') ON CONFLICT(email) DO NOTHING RETURNING id",
    [address, await hash(secret, 12)],
  );
  console.log(
    result.rowCount
      ? "Administrator created. Clear bootstrap variables now."
      : "Account already exists; no role changed.",
  );
} finally {
  await pool.end();
}
