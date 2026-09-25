import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";

const dbPath = path.resolve(__dirname, "prisma", "test.db");

export default function setup(): () => void {
  if (existsSync(dbPath)) unlinkSync(dbPath);

  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    cwd: __dirname,
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    stdio: "inherit",
  });

  return () => {
    if (existsSync(dbPath)) unlinkSync(dbPath);
    for (const suffix of ["-journal", "-wal", "-shm"]) {
      const sidecar = dbPath + suffix;
      if (existsSync(sidecar)) unlinkSync(sidecar);
    }
  };
}
