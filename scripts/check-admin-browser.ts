import { chromium, type Browser } from "@playwright/test";
import {
  AdminValidationError,
  validateAdminBrowser,
} from "./lib/admin-browser-validation";
let browser: Browser | undefined;
let startupStage = "configuration";
try {
  const origin = process.env.ADMIN_CHECK_URL ?? "";
  // Protected production entry point never sends credentials over HTTP.
  if (!origin.startsWith("https://")) throw new Error();
  startupStage = "browser startup";
  browser = await chromium.launch({ headless: true });
  const result = await validateAdminBrowser(
    browser,
    {
      origin,
      email: process.env.ADMIN_CHECK_EMAIL ?? "",
      password: process.env.ADMIN_CHECK_PASSWORD ?? "",
    },
    (message) => console.log(message),
  );
  console.log(
    `Production admin browser validation passed: ${JSON.stringify(result)}`,
  );
} catch (error) {
  console.error(
    `Admin browser validation failed at ${error instanceof AdminValidationError ? error.stage : startupStage}. No page data or credentials were logged.`,
  );
  process.exitCode = 1;
} finally {
  await browser?.close();
}
