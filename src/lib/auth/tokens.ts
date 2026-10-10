import { createHash, randomBytes } from "node:crypto";

/** A 256-bit random token, URL-safe. Only ever shown to the user once; the database keeps its hash. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
