import Link from "next/link";
import { companyInfo } from "../lib/company";
import type { ReactNode } from "react";
export function Brand() {
  return (
    <Link href="/" className="brand">
      <span className="brand-icon">S</span>staypunch
      <span className="brand-number">360</span>
    </Link>
  );
}
export function Badge({
  children = "Coming Soon",
  tone = "soon",
}: {
  children?: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function PublicHeader() {
  return (
    <header className="public-header">
      <Brand />
      <nav aria-label="Main navigation">
        <Link href="/features">Platform</Link>
        <Link href="/integrations">Integrations</Link>
        <Link href="/pricing">Pricing</Link>
        <Link href="/about">Company</Link>
      </nav>
      <div className="header-actions">
        <Link href="/login">Log in ›</Link>
        <Link className="button small-button" href="/request-demo">
          Get a demo
        </Link>
      </div>
    </header>
  );
}
export async function Footer() {
  const company = await companyInfo();
  return (
    <footer className="public-footer">
      <div>
        <Brand />
        <p>
          One connected foundation.
          <br />
          Every exceptional stay.
        </p>
        <span className="muted small">
          © {new Date().getFullYear()} {company?.name ?? "StayPunch360"}
        </span>
      </div>
      <div>
        <h3>Platform</h3>
        {[
          "features",
          "channel-manager",
          "property-management-system",
          "booking-engine",
          "revenue-management",
          "hotel-operations",
          "integrations",
        ].map((s) => (
          <Link key={s} href={`/${s}`}>
            {s.replaceAll("-", " ")}
          </Link>
        ))}
      </div>
      <div>
        <h3>Company</h3>
        {["about", "pricing", "contact", "request-demo", "faq", "blog"].map(
          (s) => (
            <Link key={s} href={`/${s}`}>
              {s.replaceAll("-", " ")}
            </Link>
          ),
        )}
      </div>
      <div>
        <h3>Get started</h3>
        {company?.contactEmail && (
          <a href={`mailto:${company.contactEmail}`}>{company.contactEmail}</a>
        )}
        <Link href="/register">Create an account</Link>
        <Link href="/login">Customer login</Link>
        <Link href="/privacy-policy">Privacy policy</Link>
        <Link href="/terms">Terms & conditions</Link>
        <p className="small muted">
          Built for hotels, resorts
          <br />
          and homestays.
        </p>
      </div>
    </footer>
  );
}
export function Empty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="empty">
      <span>◇</span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-title">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="muted">{description}</p>
    </div>
  );
}
export function Panel({
  title,
  children,
  id,
}: {
  title: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section className="panel" id={id}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
