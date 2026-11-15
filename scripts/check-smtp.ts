import { randomUUID } from "node:crypto";
import { z } from "zod";
import { smtpProvider } from "../lib/email/smtp";
let provider: ReturnType<typeof smtpProvider> | undefined;
try {
  const send = process.argv.includes("--send-test");
  if (send && process.env.SMTP_TEST_CONFIRMATION !== "SEND-STAYPUNCH-SMTP-TEST")
    throw new Error();
  const recipient = send
    ? z.string().email().parse(process.env.EMAIL_TEST_RECIPIENT)
    : undefined;
  provider = smtpProvider();
  await provider.verify?.();
  console.log(
    "SMTP TLS and authentication verification passed; no account token was generated.",
  );
  if (recipient) {
    await provider.send({
      id: randomUUID(),
      to: recipient,
      subject: "StayPunch360 controlled SMTP test",
      text: "This is an approved SMTP configuration test. No account action is required and no account token is included.",
    });
    console.log(
      "One controlled message accepted by SMTP. Confirm inbox receipt separately before enabling general delivery.",
    );
  }
} catch {
  console.error(
    "SMTP check failed. Credentials, addresses, responses and message contents are not logged.",
  );
  process.exitCode = 1;
} finally {
  provider?.close?.();
}
