import { webhookProvider, type EmailProvider } from "./provider";
import { smtpProvider } from "./smtp";
export function sendingEnabled(
  env: Record<string, string | undefined> = process.env,
) {
  if (
    env.EMAIL_SENDING_ENABLED &&
    !["true", "false"].includes(env.EMAIL_SENDING_ENABLED)
  )
    throw new Error("EMAIL_SENDING_ENABLED must be true or false");
  return env.EMAIL_SENDING_ENABLED === "true";
}
function bounded(value: string | undefined, fallback: number, max: number) {
  const n = value === undefined || value === "" ? fallback : Number(value);
  if (!Number.isInteger(n) || n < 1 || n > max)
    throw new Error("Invalid email send limits");
  return n;
}
export function emailLimits(
  env: Record<string, string | undefined> = process.env,
) {
  return {
    batchSize: bounded(env.EMAIL_BATCH_SIZE, 10, 50),
    maxPerMinute: bounded(env.EMAIL_MAX_PER_MINUTE, 5, 30),
  };
}
export function configuredProvider(
  env: Record<string, string | undefined> = process.env,
): EmailProvider {
  if (env.EMAIL_PROVIDER === "smtp") return smtpProvider(env);
  if (env.EMAIL_PROVIDER === "webhook") return webhookProvider(env);
  throw new Error("Explicit email provider selection is required");
}
