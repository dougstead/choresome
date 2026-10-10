import { readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/auth/errors";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { hit } from "@/lib/auth/rate-limit";
import { createSession, findSessionByToken } from "@/lib/auth/session";
import { hashToken } from "@/lib/auth/tokens";
import { safeNextPath } from "@/lib/safe-redirect";
import { resetDb } from "@/lib/test/reset-db";
import { authenticate, createUser, requestPasswordReset, resetPassword, updateAccount } from "./account-service";

const PASSWORD = "correct horse battery";
const outbox = path.resolve(process.cwd(), "data", "outbox");

beforeEach(async () => {
  await resetDb();
});

describe("password hashing", () => {
  it("verifies the right password and rejects the wrong one", async () => {
    const hash = await hashPassword(PASSWORD);
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(hash).not.toContain(PASSWORD);
    expect(await verifyPassword(PASSWORD, hash)).toBe(true);
    expect(await verifyPassword("wrong password!", hash)).toBe(false);
    expect(await verifyPassword(PASSWORD, "garbage")).toBe(false);
  });
});

describe("accounts", () => {
  it("rejects a duplicate email and authenticates case-insensitively stored emails", async () => {
    await createUser({ email: "alex@example.com", name: "Alex", password: PASSWORD });
    await expect(createUser({ email: "alex@example.com", name: "Alex 2", password: PASSWORD })).rejects.toThrow(HttpError);

    expect(await authenticate("alex@example.com", PASSWORD)).toMatchObject({ email: "alex@example.com" });
    expect(await authenticate("alex@example.com", "nope nope nope")).toBeNull();
    expect(await authenticate("nobody@example.com", PASSWORD)).toBeNull();
  });

  it("requires the current password to change password, and then signs out other sessions", async () => {
    const user = await createUser({ email: "alex@example.com", name: "Alex", password: PASSWORD });
    const here = await createSession({ userId: user.id, householdId: null });
    const elsewhere = await createSession({ userId: user.id, householdId: null });
    const hereSession = await findSessionByToken(here);

    await expect(
      updateAccount(user.id, hereSession!.id, { newPassword: "brand new password", currentPassword: "wrong" })
    ).rejects.toThrow(/incorrect/);

    await updateAccount(user.id, hereSession!.id, { newPassword: "brand new password", currentPassword: PASSWORD });
    expect(await authenticate("alex@example.com", "brand new password")).not.toBeNull();
    expect(await findSessionByToken(here)).not.toBeNull();
    expect(await findSessionByToken(elsewhere)).toBeNull();
  });
});

describe("sessions", () => {
  it("stores only a hash of the token and expires idle sessions", async () => {
    const user = await createUser({ email: "alex@example.com", name: "Alex", password: PASSWORD });
    const token = await createSession({ userId: user.id, householdId: null });
    const row = await prisma.session.findFirstOrThrow();
    expect(row.tokenHash).toBe(hashToken(token));
    expect(row.tokenHash).not.toBe(token);

    await prisma.session.update({ where: { id: row.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await findSessionByToken(token)).toBeNull();
    expect(await prisma.session.count()).toBe(0);
  });
});

describe("password reset", () => {
  it("emails a single-use link that resets the password and ends all sessions", async () => {
    await rm(outbox, { recursive: true, force: true });
    const user = await createUser({ email: "reset-test@example.com", name: "Alex", password: PASSWORD });
    const session = await createSession({ userId: user.id, householdId: null });

    await requestPasswordReset("reset-test@example.com");
    await requestPasswordReset("nobody@example.com"); // silently does nothing

    const files = (await readdir(outbox)).filter((f) => f.includes("reset-test@example.com"));
    expect(files).toHaveLength(1);
    const mail = await readFile(path.join(outbox, files[0]!), "utf8");
    const token = /reset-password\/([\w-]+)/.exec(mail)?.[1];
    expect(token).toBeTruthy();

    await resetPassword(token!, "a different password");
    expect(await authenticate("reset-test@example.com", "a different password")).not.toBeNull();
    expect(await findSessionByToken(session)).toBeNull();
    await expect(resetPassword(token!, "yet another password")).rejects.toThrow(/invalid|used/);
    await rm(outbox, { recursive: true, force: true });
  });
});

describe("rate limiting", () => {
  it("allows up to the limit per window, then blocks until it resets", () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) expect(hit("test:key", 3, 60_000, now)).toBe(true);
    expect(hit("test:key", 3, 60_000, now)).toBe(false);
    expect(hit("test:key", 3, 60_000, now + 60_001)).toBe(true);
  });
});

describe("post-login redirects", () => {
  it("only allows same-site paths", () => {
    expect(safeNextPath("/display")).toBe("/display");
    expect(safeNextPath("/nfc/complete/abc?x=1")).toBe("/nfc/complete/abc?x=1");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
  });
});
