import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { SMTPServer } from "smtp-server";
import type { AddressInfo } from "node:net";
import { smtpProvider, smtpFailure } from "../lib/email/smtp";
import { DeliveryError } from "../lib/email/provider";
import { sendingEnabled, emailLimits } from "../lib/email/config";
import { renderEmail } from "../lib/email/messages";
import { emailPolicy } from "../lib/email/policy";
const run = promisify(execFile);
let folder: string, key: string, cert: string;
before(async () => {
  folder = await mkdtemp(join(tmpdir(), "staypunch-smtp-"));
  await run("openssl", [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    join(folder, "key.pem"),
    "-out",
    join(folder, "cert.pem"),
    "-days",
    "1",
    "-subj",
    "/CN=localhost",
    "-addext",
    "subjectAltName=DNS:localhost,IP:127.0.0.1",
  ]);
  key = await readFile(join(folder, "key.pem"), "utf8");
  cert = await readFile(join(folder, "cert.pem"), "utf8");
});
after(async () => {
  await rm(folder, { recursive: true, force: true });
});
async function mock(
  options: {
    reject?: number;
    badAuth?: boolean;
    certificate?: { key: string; cert: string };
  } = {},
) {
  const messages: string[] = [];
  let encrypted = true;
  const server = new SMTPServer({
    secure: true,
    key: options.certificate?.key ?? key,
    cert: options.certificate?.cert ?? cert,
    logger: false,
    onAuth(auth, session, callback) {
      encrypted &&= session.secure;
      if (
        options.badAuth ||
        auth.username !== "staypunch@salespunch360.com" ||
        auth.password !== "synthetic-mailbox-password"
      )
        return callback(
          Object.assign(new Error("synthetic authentication rejection"), {
            responseCode: 535,
          }),
        );
      callback(null, { user: "synthetic" });
    },
    onData(stream, _session, callback) {
      let message = "";
      stream.on("data", (chunk) => {
        message += chunk.toString();
      });
      stream.on("end", () => {
        if (options.reject)
          return callback(
            Object.assign(new Error("synthetic rejection"), {
              responseCode: options.reject,
            }),
          );
        messages.push(message);
        callback();
      });
    },
  });
  server.on("error", () => {}); // Expected TLS rejection can also surface on the server.
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.server.address() as AddressInfo).port;
  const env = {
    NODE_ENV: "test" as const,
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: String(port),
    SMTP_SECURE: "true",
    SMTP_USER: "staypunch@salespunch360.com",
    SMTP_FROM: "staypunch@salespunch360.com",
    SMTP_PASSWORD: "synthetic-mailbox-password",
  };
  return {
    messages,
    env,
    encrypted: () => encrypted,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
test("mock implicit-TLS SMTP verifies auth and accepts reset, verification and invitation messages without real sending", async () => {
  const server = await mock(),
    provider = smtpProvider(server.env, cert);
  try {
    await provider.verify?.();
    assert.equal(server.messages.length, 0);
    for (const kind of [
      "password_reset",
      "verification",
      "staff_invitation",
    ] as const) {
      const message = renderEmail({
        kind,
        recipient: "recipient@example.test",
        link: `https://app.example.test/${kind}?token=synthetic-test-token`,
      });
      const id = randomUUID();
      const receipt = await provider.send({
        id,
        to: message.recipient,
        subject: message.subject,
        text: message.text,
      });
      assert.deepEqual(receipt, { outcome: "accepted", receipt: `smtp:${id}` });
      assert.ok(
        server.messages
          .at(-1)
          ?.includes(`Message-ID: <${id}@salespunch360.com>`),
      );
    }
    assert.equal(server.messages.length, 3);
    assert.equal(server.encrypted(), true);
  } finally {
    provider.close?.();
    await server.close();
  }
});
test("SMTP failures stay sanitized; transient, permanent and credential failures are distinct", async () => {
  for (const [reject, permanent] of [
    [451, false],
    [550, true],
  ] as const) {
    const server = await mock({ reject }),
      provider = smtpProvider(server.env, cert);
    try {
      await assert.rejects(
        provider.send({
          id: randomUUID(),
          to: "recipient@example.test",
          subject: "Test",
          text: "synthetic",
        }),
        (error) =>
          error instanceof DeliveryError &&
          error.permanent === permanent &&
          !error.message.includes("synthetic"),
      );
    } finally {
      provider.close?.();
      await server.close();
    }
  }
  const server = await mock({ badAuth: true }),
    provider = smtpProvider(server.env, cert);
  try {
    await assert.rejects(
      provider.verify!(),
      (error) =>
        error instanceof DeliveryError &&
        error.code === "SMTP_AUTH" &&
        error.haltBatch,
    );
    assert.equal(server.messages.length, 0);
  } finally {
    provider.close?.();
    await server.close();
  }
  assert.equal(
    smtpFailure({ code: "ETIMEDOUT", message: "sensitive password and token" })
      .message,
    "SMTP_TRANSPORT",
  );
});
test("SMTP never disables certificate validation and rejects header injection", async () => {
  const server = await mock(),
    untrusted = smtpProvider(server.env);
  try {
    await assert.rejects(
      untrusted.verify!(),
      (error) => error instanceof DeliveryError && error.haltBatch,
    );
    assert.equal(server.messages.length, 0);
  } finally {
    untrusted.close?.();
  }
  const provider = smtpProvider(server.env, cert);
  try {
    await assert.rejects(
      provider.send({
        id: randomUUID(),
        to: "recipient@example.test",
        subject: "Test\r\nBcc: injected@example.test",
        text: "synthetic",
      }),
      (error) =>
        error instanceof DeliveryError && error.code === "INVALID_MESSAGE",
    );
    assert.equal(server.messages.length, 0);
    assert.throws(() =>
      smtpProvider({ ...server.env, NODE_ENV: "production" }, cert),
    );
    assert.throws(() =>
      smtpProvider({ ...server.env, SMTP_SECURE: "false" }, cert),
    );
    assert.throws(() =>
      smtpProvider({ ...server.env, SMTP_FROM: "other@example.test" }, cert),
    );
  } finally {
    provider.close?.();
    await server.close();
  }
});
test("sending defaults off, validates bounded limits, and rejects expired, legacy and unreleased mail", async () => {
  assert.equal(sendingEnabled({}), false);
  assert.equal(sendingEnabled({ EMAIL_SENDING_ENABLED: "false" }), false);
  assert.throws(() => sendingEnabled({ EMAIL_SENDING_ENABLED: "yes" }));
  assert.deepEqual(emailLimits({}), { batchSize: 10, maxPerMinute: 5 });
  assert.throws(() => emailLimits({ EMAIL_MAX_PER_MINUTE: "0" }));
  const created_at = new Date("2026-01-01T00:00:00Z");
  for (const [kind, seconds] of [
    ["password_reset", 1800],
    ["verification", 86400],
    ["staff_invitation", 259200],
  ] as const) {
    assert.equal(
      emailPolicy(
        { kind, body: "synthetic", created_at },
        new Date(+created_at + seconds * 1000 - 1),
      ),
      null,
    );
    assert.equal(
      emailPolicy(
        { kind, body: "synthetic", created_at },
        new Date(+created_at + seconds * 1000),
      ),
      "TOKEN_EXPIRED",
    );
  }
  assert.equal(
    emailPolicy(
      {
        kind: "account_notification",
        body: "https://example.test?token=synthetic",
        created_at,
      },
      created_at,
    ),
    "LEGACY_TOKEN_METADATA_MISSING",
  );
  assert.equal(
    emailPolicy(
      { kind: "booking_confirmation", body: "synthetic", created_at },
      created_at,
    ),
    "UNRELEASED_EMAIL_KIND",
  );
  const env = {
    ...process.env,
    EMAIL_SENDING_ENABLED: "false",
    EMAIL_DATABASE_URL: "invalid",
    SMTP_HOST: "invalid",
    SMTP_PASSWORD: "synthetic-private-marker",
  };
  const result = await run(
    process.execPath,
    ["--import", "tsx", "scripts/deliver-email.ts"],
    { env },
  );
  assert.ok(result.stdout.includes("No database or SMTP connection opened"));
  assert.ok(
    !`${result.stdout}${result.stderr}`.includes("synthetic-private-marker"),
  );
  await assert.rejects(
    run(
      process.execPath,
      ["--import", "tsx", "scripts/check-smtp.ts", "--send-test"],
      { env },
    ),
    (error) => {
      const e = error as { stderr: string };
      return (
        e.stderr.includes("SMTP check failed") &&
        !e.stderr.includes("synthetic-private-marker")
      );
    },
  );
});

test("trusted certificate still fails if SMTP hostname does not match", async () => {
  await run("openssl", [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    join(folder, "wrong-key.pem"),
    "-out",
    join(folder, "wrong-cert.pem"),
    "-days",
    "1",
    "-subj",
    "/CN=wrong.example.test",
    "-addext",
    "subjectAltName=DNS:wrong.example.test",
  ]);
  const wrong = {
    key: await readFile(join(folder, "wrong-key.pem"), "utf8"),
    cert: await readFile(join(folder, "wrong-cert.pem"), "utf8"),
  };
  const server = await mock({ certificate: wrong }),
    provider = smtpProvider(server.env, wrong.cert);
  try {
    await assert.rejects(
      provider.verify!(),
      (error) => error instanceof DeliveryError && error.haltBatch,
    );
    assert.equal(server.messages.length, 0);
  } finally {
    provider.close?.();
    await server.close();
  }
});
test("worker SMTP preflight stops on bad credentials without opening the database", async () => {
  const server = await mock({ badAuth: true });
  try {
    await assert.rejects(
      run(process.execPath, ["--import", "tsx", "scripts/deliver-email.ts"], {
        env: {
          ...process.env,
          ...server.env,
          NODE_EXTRA_CA_CERTS: join(folder, "cert.pem"),
          EMAIL_PROVIDER: "smtp",
          EMAIL_SENDING_ENABLED: "true",
          EMAIL_DATABASE_URL: "invalid",
        },
      }),
      (error) => {
        const e = error as { stderr: string };
        return (
          e.stderr.includes("Email worker failed") &&
          !e.stderr.includes("synthetic-mailbox-password")
        );
      },
    );
    assert.equal(server.messages.length, 0);
  } finally {
    await server.close();
  }
});
test("explicitly confirmed test sends only one token-free mock message while general sending stays disabled", async () => {
  const server = await mock();
  try {
    const env = {
      ...process.env,
      ...server.env,
      NODE_EXTRA_CA_CERTS: join(folder, "cert.pem"),
      EMAIL_SENDING_ENABLED: "false",
      SMTP_TEST_CONFIRMATION: "SEND-STAYPUNCH-SMTP-TEST",
      EMAIL_TEST_RECIPIENT: "approved@example.test",
    };
    const result = await run(
      process.execPath,
      ["--import", "tsx", "scripts/check-smtp.ts", "--send-test"],
      { env },
    );
    assert.ok(result.stdout.includes("One controlled message accepted"));
    assert.equal(server.messages.length, 1);
    assert.ok(!server.messages[0].includes("token="));
    assert.ok(!`${result.stdout}${result.stderr}`.includes(env.SMTP_PASSWORD));
    assert.equal(env.EMAIL_SENDING_ENABLED, "false");
  } finally {
    await server.close();
  }
});
test("controlled SMTP workflow stays manual and cannot drain the outbox", async () => {
  const workflow = await readFile(
    ".github/workflows/manual-smtp-check.yml",
    "utf8",
  );
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /github.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /EMAIL_SENDING_ENABLED: "false"/);
  assert.match(workflow, /SEND-STAYPUNCH-SMTP-TEST/);
  assert.doesNotMatch(
    workflow,
    /schedule:|email:deliver|MIGRATION_DATABASE_URL|EMAIL_DATABASE_URL/,
  );
});

test("delivery workflow requires separate enablement and has no automatic schedule or owner credentials", async () => {
  const workflow = await readFile(
    ".github/workflows/manual-email-delivery.yml",
    "utf8",
  );
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /github.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /test "\$EMAIL_SENDING_ENABLED" = "true"/);
  assert.match(workflow, /vars.EMAIL_SENDING_ENABLED \|\| 'false'/);
  assert.match(workflow, /DELIVER-STAYPUNCH-AUTH-EMAILS/);
  assert.doesNotMatch(
    workflow,
    /schedule:|MIGRATION_DATABASE_URL|STAYPUNCH_MIGRATION_DATABASE_URL|BOOTSTRAP_ADMIN/,
  );
});
