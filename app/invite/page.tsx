import Link from "next/link";
import { actor } from "../../lib/security";
import { Form, Field } from "../../components/forms";
import { Brand } from "../../components/ui";
export default async function Invite({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const u = await actor();
  return (
    <main className="auth-single">
      <Brand />
      <div className="panel narrow">
        <h1>Join your property team.</h1>
        {!token ? (
          <p>Open the invitation link from your email.</p>
        ) : u ? (
          <Form
            endpoint="/api/auth/accept-invite"
            values={{ token }}
            label="Accept invitation"
          >
            <p>Signed in as {u.email}. The invitation must match this email.</p>
          </Form>
        ) : (
          <>
            <p>
              Sign in with the invited email, then reopen this link. You can
              also create a staff account below.
            </p>
            <Link className="button" href="/login">
              Sign in
            </Link>
            <h2>Create a staff account</h2>
            <Form
              endpoint="/api/auth/register-staff"
              values={{ token }}
              label="Create account and join"
            >
              <Field label="Your name" name="name" />
              <Field label="Invited email" name="email" type="email" />
              <Field
                label="Password (12–72 bytes)"
                name="password"
                type="password"
              />
            </Form>
          </>
        )}
      </div>
    </main>
  );
}
