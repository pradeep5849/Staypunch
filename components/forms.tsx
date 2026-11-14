"use client";
import Link from "next/link";
import { useState, type ReactNode, type FormEvent } from "react";
import { useRouter } from "next/navigation";
export function Form({
  endpoint,
  children,
  values = {},
  label = "Save changes",
  transform,
}: {
  endpoint: string;
  children?: ReactNode;
  values?: Record<string, unknown>;
  label?: string;
  transform?:
    "profile" | "plan" | "subscription" | "lead" | "support" | "entitlement";
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const router = useRouter();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const entries = Object.fromEntries(new FormData(e.currentTarget));
    const data: Record<string, unknown> = { ...values, ...entries };
    if (transform === "profile")
      data.amenities = String(data.amenities ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    if (transform === "subscription")
      data.renewsAt = data.renewsAt
        ? new Date(String(data.renewsAt)).toISOString()
        : null;
    if (transform === "lead" || transform === "support")
      data.assignedTo = data.assignedTo || null;
    if (transform === "entitlement") {
      data.enabled = data.enabled === "true";
      if (!data.propertyId) delete data.propertyId;
      if (!data.planId) delete data.planId;
    }
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      setError(!res.ok);
      setMessage(json.error ?? json.message ?? "Saved successfully.");
      if (res.ok) {
        if (json.redirect) router.push(json.redirect);
        router.refresh();
      }
    } catch {
      setError(true);
      setMessage("Unable to connect. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="form">
      {children}
      <button disabled={busy} type="submit">
        {busy ? "Please wait…" : label}
      </button>
      {message && (
        <p
          className={error ? "error" : "success"}
          role={error ? "alert" : "status"}
        >
          {message}
        </p>
      )}
    </form>
  );
}
export function Field({
  label,
  name,
  type = "text",
  value,
  required = true,
  min,
  max,
  placeholder,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  value?: string | number;
  required?: boolean;
  min?: number;
  max?: number;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        step={type === "number" ? "any" : undefined}
        defaultValue={value}
        required={required}
        min={min}
        max={max}
        placeholder={placeholder}
      />
    </label>
  );
}
export function Select({
  label,
  name,
  options,
  value,
}: {
  label: string;
  name: string;
  options: string[];
  value?: string;
}) {
  return (
    <label>
      {label}
      <select name={name} defaultValue={value}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
}
export function Textarea({
  label,
  name,
  value,
  required = false,
}: {
  label: string;
  name: string;
  value?: string;
  required?: boolean;
}) {
  return (
    <label>
      {label}
      <textarea name={name} defaultValue={value} required={required} rows={3} />
    </label>
  );
}
export function LeadForm({
  kind = "demo",
}: {
  kind?: "demo" | "contact" | "trial";
}) {
  return (
    <Form
      endpoint="/api/leads"
      values={{ kind }}
      label={kind === "demo" ? "Request a personal demo" : "Send enquiry"}
    >
      <div className="two">
        <Field label="Your name" name="name" />
        <Field label="Work email" name="email" type="email" />
      </div>
      <Field label="Property or company" name="propertyName" required={false} />
      <Textarea label="How can we help?" name="message" />
      <label className="honeypot" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <p className="muted small">
        By submitting, you agree to our{" "}
        <Link href="/privacy-policy">privacy policy</Link>. No payment details
        required.
      </p>
    </Form>
  );
}
export function Logout() {
  return <Form endpoint="/api/auth/logout" label="Sign out" />;
}
