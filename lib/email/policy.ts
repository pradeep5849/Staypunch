const lifetime: Record<string, number> = {
  password_reset: 30 * 60,
  verification: 24 * 60 * 60,
  staff_invitation: 3 * 24 * 60 * 60,
};
export function emailPolicy(
  mail: { kind: string; body: string; created_at: Date },
  now: Date,
): string | null {
  if (["booking_confirmation", "reservation_cancellation"].includes(mail.kind))
    return "UNRELEASED_EMAIL_KIND";
  const ttl = lifetime[mail.kind];
  if (ttl !== undefined)
    return now.getTime() >= new Date(mail.created_at).getTime() + ttl * 1000
      ? "TOKEN_EXPIRED"
      : null;
  if (mail.kind !== "account_notification" || /[?&]token=/i.test(mail.body))
    return "LEGACY_TOKEN_METADATA_MISSING";
  return null;
}
