import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: { DATABASE_URL: "file:./test.db" },
    globalSetup: ["./vitest.global-setup.ts"],
    // Integration tests share one SQLite file; run test files one at a time
    // to avoid concurrent-write contention against it.
    fileParallelism: false,
  },
});
