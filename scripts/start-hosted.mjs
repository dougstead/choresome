/**
 * Production entry point for the hosted (multi-household) service:
 * applies any pending database migrations, then starts `next start`.
 * Run after `npm run build`. All configuration comes from environment
 * variables (see .env.example), e.g. with Node's own env-file loader:
 *
 *   node --env-file=.env.hosted.local scripts/start-hosted.mjs
 *
 * Exits non-zero if migrations fail, so a supervisor (systemd, Task
 * Scheduler, a container runtime) sees a failed start rather than an app
 * running against an out-of-date schema.
 */
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = process.env.PORT || "3010";
process.env.NODE_ENV = "production";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. See .env.example.");
  process.exit(1);
}

console.log("Applying database migrations...");
const migrate = spawnSync(process.execPath, [path.join(root, "node_modules/prisma/build/index.js"), "migrate", "deploy"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
if (migrate.status !== 0) {
  console.error("Migrations failed; not starting the server.");
  process.exit(migrate.status ?? 1);
}

console.log(`Starting Choresome on port ${port}...`);
const server = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "start", "-p", port], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}
server.on("exit", (code) => process.exit(code ?? 0));
