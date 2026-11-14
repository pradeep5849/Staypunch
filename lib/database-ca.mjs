import { X509Certificate } from "node:crypto";

/** Normalize representation only; every certificate must still be valid X.509. */
export function normalizeCaPem(raw) {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("The configured database CA certificate is missing.");
  }
  const normalized = raw
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n?/g, "\n")
    .trim();
  const blocks = normalized.match(
    /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g,
  );
  try {
    if (
      !blocks?.length ||
      normalized
        .replace(
          /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g,
          "",
        )
        .trim()
    )
      throw new Error();
    for (const block of blocks) new X509Certificate(block);
  } catch {
    throw new Error(
      "The configured database CA certificate is not a valid PEM certificate bundle.",
    );
  }
  return blocks.join("\n") + "\n";
}
