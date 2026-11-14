import { NextRequest, NextResponse } from "next/server";
export function proxy(req: NextRequest) {
  const host = req.headers.get("host")?.split(":")[0].toLowerCase();
  const path = req.nextUrl.pathname;
  const base =
    host === "admin.staypunch360.com"
      ? "/admin"
      : host === "app.staypunch360.com"
        ? "/app"
        : null;
  if (
    base &&
    !path.startsWith("/api/") &&
    !path.startsWith("/_next/") &&
    !["/login", "/register", "/reset-password", "/invite"].includes(path) &&
    !path.startsWith("/admin") &&
    !path.startsWith("/app")
  ) {
    const url = req.nextUrl.clone();
    url.pathname = base + (path === "/" ? "" : path);
    return NextResponse.rewrite(url);
  }
  if (["book.staypunch360.com", "api.staypunch360.com"].includes(host ?? ""))
    return new NextResponse("This service is not released.", {
      status: 503,
      headers: { "Content-Type": "text/plain", "Retry-After": "86400" },
    });
  return NextResponse.next();
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
