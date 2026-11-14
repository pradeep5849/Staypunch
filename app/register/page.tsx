import Link from "next/link";
import { Brand } from "../../components/ui";
import { Form, Field } from "../../components/forms";
export default function Register() {
  return (
    <main className="auth-layout">
      <div className="auth-story">
        <Brand />
        <p className="eyebrow">A FRESH START</p>
        <h1>
          Your next chapter
          <br />
          begins right here.
        </h1>
        <p>
          Set up your property and explore the foundation.
          <br />
          Operational modules remain Coming Soon.
        </p>
        <span>No payment details required.</span>
      </div>
      <div className="auth-content">
        <div className="auth-card">
          <h1>Make yourself at home.</h1>
          <p className="muted">Register your property for platform approval.</p>
          <Form endpoint="/api/auth/register" label="Create my workspace →">
            <Field label="Your name" name="name" />
            <Field label="Property name" name="propertyName" />
            <Field label="Email address" name="email" type="email" />
            <Field
              label="Password (12–72 bytes)"
              name="password"
              type="password"
            />
            <label className="honeypot" aria-hidden="true">
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
            <p className="small muted">
              By registering, you accept our <Link href="/terms">terms</Link>{" "}
              and <Link href="/privacy-policy">privacy policy</Link>.
            </p>
          </Form>
          <p className="small">
            Already registered? <Link href="/login">Sign in ›</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
