import { Brand } from "../../components/ui";
import { Form, Field } from "../../components/forms";
export default async function Reset({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <main className="auth-single">
      <Brand />
      <div className="panel narrow">
        <h1>{token ? "Choose a new password" : "Reset your password"}</h1>
        <p className="muted">
          Reset links expire after 30 minutes and can be used once.
        </p>
        <Form
          endpoint={`/api/auth/${token ? "reset" : "reset-request"}`}
          values={token ? { token } : {}}
          label={token ? "Update password" : "Request reset email"}
        >
          {token ? (
            <Field
              label="New password (12–72 bytes)"
              name="password"
              type="password"
            />
          ) : (
            <Field label="Email address" name="email" type="email" />
          )}
        </Form>
      </div>
    </main>
  );
}
