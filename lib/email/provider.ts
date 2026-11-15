export type DeliveryMessage = {
  id: string;
  to: string;
  subject: string;
  text: string;
};
export type DeliveryReceipt = {
  outcome: "accepted" | "simulated";
  receipt: string;
};
export interface EmailProvider {
  send(message: DeliveryMessage): Promise<DeliveryReceipt>;
  verify?(): Promise<void>;
  close?(): void;
}
export class DeliveryError extends Error {
  constructor(
    public code: string,
    public permanent = false,
    public haltBatch = false,
  ) {
    super(code);
  }
}
export function webhookProvider(
  env: Record<string, string | undefined> = process.env,
  transport: typeof fetch = fetch,
): EmailProvider {
  const value = env.EMAIL_DELIVERY_WEBHOOK;
  const credential = env.EMAIL_DELIVERY_TOKEN;
  if (!value || !credential)
    throw new Error("Email delivery is not configured");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("Email adapter must use HTTPS without URL credentials");
  return {
    async send(message) {
      try {
        const response = await transport(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${credential}`,
            "Content-Type": "application/json",
            "Idempotency-Key": message.id,
          },
          body: JSON.stringify(message),
          signal: AbortSignal.timeout(15000),
          redirect: "error",
        });
        if (!response.ok)
          throw new DeliveryError(
            `HTTP_${response.status}`,
            response.status >= 400 &&
              response.status < 500 &&
              ![408, 429].includes(response.status),
          );
        const ack = await response.json();
        if (
          ack?.accepted !== true ||
          typeof ack.receipt !== "string" ||
          !ack.receipt.length ||
          ack.receipt.length > 200
        )
          throw new DeliveryError("INVALID_RECEIPT");
        return { outcome: "accepted", receipt: ack.receipt };
      } catch (e) {
        if (e instanceof DeliveryError) throw e;
        throw new DeliveryError("TRANSPORT_FAILURE");
      }
    },
  };
}
// Explicitly simulated; used only by automated/local tests, never selected by the CLI.
export class TestEmailProvider implements EmailProvider {
  messages = new Map<string, DeliveryMessage>();
  async send(message: DeliveryMessage): Promise<DeliveryReceipt> {
    this.messages.set(message.id, message);
    return { outcome: "simulated", receipt: `test:${message.id}` };
  }
}
