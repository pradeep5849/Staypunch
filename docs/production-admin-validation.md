# Production Super Admin browser validation

Run **Manual StayPunch360 deployed admin readiness** on reviewed `main`. It uses Chromium on GitHub Actions against the existing Hostinger production URL and the existing protected administrator password. It does not bootstrap users, reset credentials, run migrations or provision roles.

The browser signs in once, shares only that in-memory test session across desktop (1440×1000), tablet (768×1024) and mobile (390×844) contexts, and signs out afterward. Tablet/mobile contexts emulate touch input. This is automated Chromium coverage, not a claim of physical-device or Safari/Firefox testing.

## Checks

- Rendered Properties, Users, Subscriptions and Settings links, URLs, headings, viewport width, page overflow and sign-out controls.
- All 39 module cards and grouped navigation links display Coming Soon.
- OTA provider Connect buttons remain disabled. Booking, Payments and Channel Manager API probes use a dummy property ID and must be denied; they do not assume a real property membership. The separate disposable owner/entitlement tests exercise the code release gate under permitted property access.
- Secure/HttpOnly/SameSite cookie flags, signed-in login redirect, session API privacy, anonymous API denials, CSRF denial, logout redirects on all four sections and rejection of the revoked session.
- Browser console errors, uncaught JavaScript errors, HTTP failures, failed network requests and unexpected write attempts. Normal interrupted non-API navigation requests are excluded from network failures.

## Production data protection

No save, approval, subscription, session-revocation, verification-email or module-release form is submitted. Browser-side writes are restricted to the existing login/logout endpoints. Explicit authorization probes target handlers whose denial paths only read access state. Production login/logout necessarily writes normal session, rate-limit and security-audit entries; the existing operator/user sessions are not revoked.

No screenshots, traces, video, cookies, storage state, response bodies, page records or raw errors are uploaded or logged. Logs contain fixed stage labels, public module counts and error counts. The local/CI acceptance test uses a disposable account and verifies fingerprints of business tables before and after the same harness, excluding the three expected authentication bookkeeping tables.

## Interpreting results

A successful workflow means the recorded automated production checks passed for that commit and host. A blocked runner, missing browser, network error or missing protected password is a failed/unavailable check, never a pass. Keep unverified items explicit in the report.

Physical-device appearance, other browser engines and behavior with larger real-world datasets still require separate manual review. Customer-role denial and session expiry are tested using disposable data, without changing production accounts or expiry timestamps.
