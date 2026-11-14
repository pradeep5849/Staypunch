import { z } from "zod";
import type { PoolClient } from "pg";
const destination = z.string().email().max(254);
export type EmailKind =
  | "verification"
  | "password_reset"
  | "staff_invitation"
  | "account_notification"
  | "booking_confirmation"
  | "reservation_cancellation";
export type MessageInput =
  | {
      kind: "verification" | "password_reset" | "staff_invitation";
      recipient: string;
      link: string;
    }
  | {
      kind: "account_notification";
      recipient: string;
      event: "password_changed" | "sessions_revoked";
    }
  | {
      kind: "booking_confirmation" | "reservation_cancellation";
      recipient: string;
      reference: string;
      propertyName: string;
    };
export function accountLink(
  path: string,
  secret: string,
  env: Record<string, string | undefined> = process.env,
) {
  const base = env.APP_URL;
  if (!base) throw new Error("APP_URL is required for account email");
  const url = new URL(base);
  if (
    url.username ||
    url.password ||
    (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      url.protocol !== "https:") ||
    !["http:", "https:"].includes(url.protocol)
  )
    throw new Error(
      "APP_URL must be a trusted HTTPS origin (HTTP loopback is development only)",
    );
  url.pathname = path;
  url.search = "";
  url.hash = "";
  url.searchParams.set("token", secret);
  return url.toString();
}
export function renderEmail(input: MessageInput) {
  const recipient = destination.parse(input.recipient);
  if ("link" in input) {
    const url = new URL(input.link);
    if (!["http:", "https:"].includes(url.protocol))
      throw new Error("Invalid account email link");
    const subject = {
      verification: "Verify your StayPunch360 email",
      password_reset: "Reset your StayPunch360 password",
      staff_invitation: "Invitation to StayPunch360",
    }[input.kind];
    return { recipient, kind: input.kind, subject, text: input.link };
  }
  if (input.kind === "account_notification") {
    return {
      recipient,
      kind: input.kind,
      subject: "StayPunch360 account security notification",
      text:
        input.event === "password_changed"
          ? "Your password was changed. All previous sessions have been revoked. If this was not you, contact platform support."
          : "Your active sessions were revoked. If this was not you, contact platform support.",
    };
  }
  const reference = z.string().min(1).max(100).parse(input.reference);
  const property = z.string().min(1).max(160).parse(input.propertyName);
  return {
    recipient,
    kind: input.kind,
    subject:
      input.kind === "booking_confirmation"
        ? `Reservation confirmation · ${property}`
        : `Reservation cancellation · ${property}`,
    text: `${input.kind === "booking_confirmation" ? "Reservation confirmed" : "Reservation cancelled"}: ${reference}. Property: ${property}.`,
  };
}
export async function enqueueEmail(db: PoolClient, input: MessageInput) {
  const message = renderEmail(input);
  await db.query(
    "INSERT INTO email_outbox(recipient,subject,body,kind) VALUES($1,$2,$3,$4)",
    [message.recipient, message.subject, message.text, message.kind],
  );
}
