import Link from "next/link";
import { Brand } from "../../components/ui";
import { Form } from "../../components/forms";
export default async function VerifyEmail({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <main className="auth-single">
      <Brand />
      <div className="panel narrow">
        <h1>Confirm your email address.</h1>
        <p>
          Verification links expire after 24 hours and can be used once. Opening
          this page does not consume your link.
        </p>
        {token ? (
          <Form
            endpoint="/api/auth/verify-email"
            values={{ token }}
            label="Verify my email"
          />
        ) : (
          <p>Sign in and request a verification email from account settings.</p>
        )}
        <p>
          <Link href="/app/settings">Return to account settings</Link>
        </p>
      </div>
    </main>
  );
}
