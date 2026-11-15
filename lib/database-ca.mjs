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
    for (let index = 0; index < blocks.length; index++) {
      // Single-line hosting inputs can remove physical line breaks when pasting.
      // Restore wrapping only; the DER bytes and trust verification do not change.
      const body = blocks[index]
        .slice(
          "-----BEGIN CERTIFICATE-----".length,
          -"-----END CERTIFICATE-----".length,
        )
        .replace(/\s/g, "");
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(body) || body.length % 4 !== 0)
        throw new Error();
      const canonical = `-----BEGIN CERTIFICATE-----\n${body.match(/.{1,64}/g).join("\n")}\n-----END CERTIFICATE-----`;
      new X509Certificate(canonical);
      blocks[index] = canonical;
    }
  } catch {
    throw new Error(
      "The configured database CA certificate is not a valid PEM certificate bundle.",
    );
  }
  return blocks.join("\n") + "\n";
}
