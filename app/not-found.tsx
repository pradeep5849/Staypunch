import Link from "next/link";
import { Brand } from "../components/ui";
export default function NotFound() {
  return (
    <main className="auth-single">
      <Brand />
      <div className="panel narrow">
        <p className="eyebrow">404 · A DIFFERENT DIRECTION</p>
        <h1>This page isn’t here.</h1>
        <p>Let’s get you back to familiar ground.</p>
        <Link className="button" href="/">
          Back to StayPunch360
        </Link>
      </div>
    </main>
  );
}
