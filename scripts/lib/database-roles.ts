import type { PoolClient } from "pg";

export async function roleCreationCommand(
  client: PoolClient,
  role: "stay_app" | "stay_mailer",
  password: string,
): Promise<string> {
  const result = await client.query<{ command: string }>(
    "SELECT format('CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS', $1::text, $2::text) AS command",
    [role, password],
  );
  return result.rows[0].command;
}
