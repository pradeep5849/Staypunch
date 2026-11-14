"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="auth-single">
      <div className="panel narrow">
        <h1>We couldn’t load this workspace.</h1>
        <p>
          The service may be unavailable or the property may be suspended. Check
          your access or contact platform support.
        </p>
        <button onClick={reset}>Try again</button>
        <p>
          <Link href="/login">Return to sign in</Link>
        </p>
      </div>
    </main>
  );
}
