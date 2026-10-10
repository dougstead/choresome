/**
 * Runs a private PostgreSQL server for local development and for running the
 * hosted build on this machine -- no system install or admin rights needed.
 * Uses the real PostgreSQL server binaries shipped by the `embedded-postgres`
 * dev dependency, with data kept in data/pg/ (gitignored).
 *
 *   npm run db:local
 *
 * Stays in the foreground; Ctrl+C stops the server cleanly. On first run it
 * initialises the cluster, then (idempotently, every run) makes sure the
 * `choresome` login role and the `choresome` (hosted), `choresome_dev`
 * (next dev) and `choresome_test` (vitest) databases exist. Passwords come
 * from .env.postgres.local (see .env.example).
 *
 * This is a development convenience, not a way to host production: a real
 * deployment points DATABASE_URL at a managed or properly installed Postgres.
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
try {
  process.loadEnvFile(path.join(root, ".env.postgres.local"));
} catch {
  // Fall through to the explicit check below.
}

const superPassword = process.env.PG_SUPERUSER_PASSWORD;
const appPassword = process.env.PG_APP_PASSWORD;
if (!superPassword || !appPassword) {
  console.error("Set PG_SUPERUSER_PASSWORD and PG_APP_PASSWORD in .env.postgres.local (see .env.example).");
  process.exit(1);
}

const port = Number(process.env.PG_LOCAL_PORT || 5433);
const databaseDir = path.join(root, "data", "pg");
const APP_ROLE = "choresome";
const DATABASES = ["choresome", "choresome_dev", "choresome_test"];

const pg = new EmbeddedPostgres({
  databaseDir,
  port,
  user: "postgres",
  password: superPassword,
  authMethod: "scram-sha-256",
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  // Never reachable from the network -- this machine only.
  postgresFlags: ["-c", "listen_addresses=localhost"],
  onLog: () => {},
  onError: (err) => console.error("[postgres]", err),
});

if (!existsSync(path.join(databaseDir, "PG_VERSION"))) {
  console.log(`Initialising a new PostgreSQL cluster in ${databaseDir}...`);
  await pg.initialise();
}

await pg.start();

const client = pg.getPgClient("postgres", "localhost");
await client.connect();
try {
  const role = await client.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [APP_ROLE]);
  // Identifiers can't be parameterised; APP_ROLE is a constant and the password is escaped as a literal.
  const passwordLiteral = `'${appPassword.replace(/'/g, "''")}'`;
  if (role.rowCount === 0) {
    // CREATEDB lets `prisma migrate dev` create its throwaway shadow database.
    await client.query(`CREATE ROLE ${APP_ROLE} LOGIN CREATEDB PASSWORD ${passwordLiteral}`);
  } else {
    await client.query(`ALTER ROLE ${APP_ROLE} WITH LOGIN CREATEDB PASSWORD ${passwordLiteral}`);
  }
  for (const db of DATABASES) {
    const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [db]);
    if (exists.rowCount === 0) await client.query(`CREATE DATABASE ${db} OWNER ${APP_ROLE}`);
  }
} finally {
  await client.end();
}

console.log(`PostgreSQL is running on localhost:${port} (databases: ${DATABASES.join(", ")}). Ctrl+C to stop.`);

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  console.log("Stopping PostgreSQL...");
  await pg.stop().catch((err) => console.error(err));
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
// Keep the process (and with it the server) alive until asked to stop.
setInterval(() => {}, 1 << 30);
