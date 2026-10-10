import { execSync } from "node:child_process";

/**
 * Brings the test database up to date by applying the real migrations
 * (`prisma migrate deploy` -- additive, never drops anything), so tests run
 * against exactly the schema production gets. Each test then clears the rows
 * it needs via resetDb(), which is why the URL must name a throwaway
 * database (see vitest.config.ts).
 */
export default function setup(): void {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set (see vitest.config.ts).");
  if (!/test/i.test(new URL(url).pathname)) {
    throw new Error(`Refusing to use "${new URL(url).pathname}" for tests: the test database name must contain "test".`);
  }

  execSync("npx prisma migrate deploy", {
    cwd: __dirname,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });
}
