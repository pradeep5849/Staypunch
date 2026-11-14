// Explicit public origins support HTTPS termination without trusting forwarded headers.
export function validRequestOrigin(
  req: Request,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const configured = [
    env.APP_URL,
    ...(env.APP_ALLOWED_ORIGINS ?? "").split(","),
  ].filter((value): value is string => !!value?.trim());
  if (!configured.length)
    return env.NODE_ENV !== "production" && origin === new URL(req.url).origin;
  try {
    return configured.some((value) => {
      const url = new URL(value.trim());
      if (
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname !== "/"
      )
        return false;
      const localTest =
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
        url.origin === new URL(req.url).origin;
      if (
        env.NODE_ENV === "production" &&
        url.protocol !== "https:" &&
        !localTest
      )
        return false;
      return (
        ["https:", "http:"].includes(url.protocol) && origin === url.origin
      );
    });
  } catch {
    return false;
  }
}
