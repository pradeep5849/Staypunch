import nodemailer from "nodemailer";
import { isIP } from "node:net";
import { z } from "zod";
import { DeliveryError, type EmailProvider } from "./provider";
const address = z.string().email().max(254);
export function smtpFailure(error: unknown): DeliveryError {
  const e = error as { code?: unknown; responseCode?: unknown } | null;
  if (e?.code === "EAUTH" || e?.responseCode === 535)
    return new DeliveryError("SMTP_AUTH", false, true);
  if (
    [
      "ETLS",
      "CERT_HAS_EXPIRED",
      "DEPTH_ZERO_SELF_SIGNED_CERT",
      "SELF_SIGNED_CERT_IN_CHAIN",
      "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      "ERR_TLS_CERT_ALTNAME_INVALID",
    ].includes(String(e?.code))
  )
    return new DeliveryError("SMTP_TLS", false, true);
  if (
    typeof e?.responseCode === "number" &&
    e.responseCode >= 500 &&
    e.responseCode < 600
  )
    return new DeliveryError("SMTP_REJECTED", true);
  if (
    typeof e?.responseCode === "number" &&
    e.responseCode >= 400 &&
    e.responseCode < 500
  )
    return new DeliveryError("SMTP_TEMPORARY");
  return new DeliveryError("SMTP_TRANSPORT", false, true);
}
export function smtpProvider(
  env: Record<string, string | undefined> = process.env,
  testCa?: string,
): EmailProvider {
  const host = env.SMTP_HOST;
  const port = Number(env.SMTP_PORT);
  const user = address.parse(env.SMTP_USER);
  const sender = address.parse(env.SMTP_FROM);
  const password = env.SMTP_PASSWORD;
  const localTest =
    env.NODE_ENV === "test" &&
    ["localhost", "127.0.0.1", "::1"].includes(host ?? "");
  if (
    !host ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    env.SMTP_SECURE !== "true" ||
    !password ||
    sender !== user ||
    /[\r\n]/.test(user) ||
    (!localTest && (host !== "smtp.hostinger.com" || port !== 465)) ||
    (testCa && !localTest)
  )
    throw new Error("Invalid secure SMTP configuration");
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: true,
    auth: { user, pass: password },
    tls: {
      rejectUnauthorized: true,
      minVersion: "TLSv1.2",
      ...(isIP(host) ? {} : { servername: host }),
      ...(testCa ? { ca: testCa } : {}),
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    logger: false,
    debug: false,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  return {
    async verify() {
      try {
        await transport.verify();
      } catch (error) {
        throw smtpFailure(error);
      }
    },
    close() {
      transport.close();
    },
    async send(message) {
      if (
        !/^[a-f0-9-]{36}$/i.test(message.id) ||
        !address.safeParse(message.to).success ||
        /[\r\n]/.test(message.to) ||
        /[\r\n]/.test(message.subject) ||
        message.subject.length > 200 ||
        message.text.length > 20000
      )
        throw new DeliveryError("INVALID_MESSAGE", true);
      try {
        const info = await transport.sendMail({
          from: { name: "StayPunch360", address: sender },
          to: message.to,
          envelope: { from: sender, to: [message.to] },
          subject: message.subject,
          text: message.text,
          messageId: `<${message.id}@${sender.split("@")[1]}>`,
          disableFileAccess: true,
          disableUrlAccess: true,
        });
        if (info.accepted?.length !== 1 || info.rejected?.length)
          throw new DeliveryError("SMTP_NOT_ACCEPTED", true);
        // Store only our fixed message ID, never raw SMTP responses or addresses.
        return { outcome: "accepted", receipt: `smtp:${message.id}` };
      } catch (error) {
        if (error instanceof DeliveryError) throw error;
        throw smtpFailure(error);
      }
    },
  };
}
