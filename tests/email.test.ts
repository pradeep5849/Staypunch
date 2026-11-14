import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  renderEmail,
  accountLink,
  type MessageInput,
} from "../lib/email/messages";
import {
  webhookProvider,
  TestEmailProvider,
  DeliveryError,
} from "../lib/email/provider";
const recipient = "mail@example.test";
const message = {
  id: randomUUID(),
  to: recipient,
  subject: "Test message",
  text: "Disposable test content",
};
test("all six email responsibilities have templates without enabling booking operations", () => {
  const kinds = [
    "verification",
    "password_reset",
    "staff_invitation",
    "account_notification",
    "booking_confirmation",
    "reservation_cancellation",
  ] as const;
  for (const kind of kinds) {
    const input = (
      ["verification", "password_reset", "staff_invitation"].includes(kind)
        ? {
            kind,
            recipient,
            link: "https://app.example.test/verify-email?token=example",
          }
        : kind === "account_notification"
          ? { kind, recipient, event: "sessions_revoked" }
          : {
              kind,
              recipient,
              reference: "TEST-ONLY",
              propertyName: "Test property",
            }
    ) as MessageInput;
    const rendered = renderEmail(input);
    assert.equal(rendered.kind, kind);
    assert.ok(rendered.subject);
    assert.ok(rendered.text);
  }
  assert.throws(() =>
    accountLink("/verify-email", "token", {
      APP_URL: "http://remote.example.test",
    }),
  );
  assert.equal(
    new URL(
      accountLink("/verify-email", "token", {
        APP_URL: "http://localhost:3100",
      }),
    ).hostname,
    "localhost",
  );
});
test("unconfigured provider fails closed and test provider reports simulated acceptance only", async () => {
  assert.throws(() => webhookProvider({}), /not configured/);
  const provider = new TestEmailProvider();
  assert.equal((await provider.send(message)).outcome, "simulated");
  await provider.send(message);
  assert.equal(provider.messages.size, 1);
});
test("webhook adapter requires explicit receipt, stable idempotency and safe transport", async () => {
  const credential = randomUUID();
  let observed = "";
  const provider = webhookProvider(
    {
      EMAIL_DELIVERY_WEBHOOK: "https://mailer.example.test/send",
      EMAIL_DELIVERY_TOKEN: credential,
    },
    async (_url, options) => {
      const headers = options?.headers as Record<string, string>;
      assert.equal(headers.Authorization, `Bearer ${credential}`);
      observed = headers["Idempotency-Key"];
      assert.equal(options?.redirect, "error");
      return Response.json({
        accepted: true,
        receipt: "test-provider-receipt",
      });
    },
  );
  assert.equal((await provider.send(message)).outcome, "accepted");
  assert.equal(observed, message.id);
  const invalid = webhookProvider(
    {
      EMAIL_DELIVERY_WEBHOOK: "https://mailer.example.test",
      EMAIL_DELIVERY_TOKEN: credential,
    },
    async () => Response.json({ ok: true }),
  );
  await assert.rejects(
    invalid.send(message),
    (e: unknown) => e instanceof DeliveryError && e.code === "INVALID_RECEIPT",
  );
});
test("provider failure classifications allow retry without recording raw response content", async () => {
  for (const [status, permanent] of [
    [429, false],
    [503, false],
    [401, true],
  ] as const) {
    const provider = webhookProvider(
      {
        EMAIL_DELIVERY_WEBHOOK: "https://mailer.example.test",
        EMAIL_DELIVERY_TOKEN: randomUUID(),
      },
      async () => new Response("Sensitive provider error body", { status }),
    );
    await assert.rejects(
      provider.send(message),
      (e: unknown) =>
        e instanceof DeliveryError &&
        e.permanent === permanent &&
        !e.message.includes("Sensitive"),
    );
  }
});
