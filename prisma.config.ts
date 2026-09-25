import path from "node:path";
import { defineConfig } from "prisma/config";

// prisma.config.ts opts out of Prisma's automatic .env loading, so we load it ourselves.
try {
  process.loadEnvFile();
} catch {
  // No .env file present (e.g. env vars supplied directly, as in Docker) — fine.
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
