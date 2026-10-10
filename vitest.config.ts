import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Integration tests run against a dedicated Postgres database that the global
// setup wipes and recreates from the schema on every run -- never point this
// at a database you care about. TEST_DATABASE_URL can live in .env.test.local.
try {
  process.loadEnvFile(".env.test.local");
} catch {
  // No local test env file -- use the environment / default below.
}
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/choresome_test?schema=public";
// Global setup runs in this process (not the test workers), so hand it the URL too.
process.env.TEST_DATABASE_URL = testDatabaseUrl;

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: { DATABASE_URL: testDatabaseUrl },
    globalSetup: ["./vitest.global-setup.ts"],
    // Integration tests share one database and reset it between tests; run
    // test files one at a time so they don't wipe each other's rows.
    fileParallelism: false,
  },
});
