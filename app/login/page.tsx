import Link from "next/link";
import { Brand } from "../../components/ui";
import { Form, Field } from "../../components/forms";
import { redirect } from "next/navigation";
import { actor } from "../../lib/security";
export default async function Login() {
  const user = await actor();
  if (user) redirect(user.platform_role === "super_admin" ? "/admin" : "/app");
  return (
    <main className="auth-layout">
      <div className="auth-story">
        <Brand />
        <p className="eyebrow">YOUR HOSPITALITY WORKSPACE</p>
        <h1>
          A little more clarity.
          <br />A lot more possibility.
        </h1>
        <p>
          Property, people and everything ahead.
          <br />
          Together in StayPunch360.
        </p>
        <span>Built for exceptional stays.</span>
      </div>
      <div className="auth-content">
        <div className="auth-card">
          <p className="eyebrow">WELCOME BACK</p>
          <h1>Good to see you.</h1>
          <p className="muted">
            Sign in to your StayPunch360 account. Authorized platform
            administrators go directly to the Super Admin dashboard.
          </p>
          <Form endpoint="/api/auth/login" label="Sign in →">
            <Field
              label="Email address"
              name="email"
              type="email"
              autoComplete="username"
            />
            <Field
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
            />
            <Link href="/reset-password" className="small">
              Forgot password?
            </Link>
          </Form>
          <p className="small">
            New here? <Link href="/register">Create a property account ›</Link>
          </p>
          <Link className="muted small" href="/">
            ← Back to website
          </Link>
        </div>
      </div>
    </main>
  );
}
