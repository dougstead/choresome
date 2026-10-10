import { prisma } from "@/lib/db";
import { config } from "@/lib/config";
import { badRequest, conflict, HttpError } from "@/lib/auth/errors";
import { getDummyHash, hashPassword, verifyPassword } from "@/lib/auth/password";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { sendMail } from "@/lib/mail/mailer";
import type { UpdateAccountInput } from "@/lib/validation/auth";
import { deleteHouseholdCompletely } from "./household-service";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export const publicUserSelect = { id: true, email: true, name: true, createdAt: true } as const;

export async function createUser(input: { email: string; name: string; password: string }) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw conflict("An account with that email already exists. Try signing in.", "email_taken");
  return prisma.user.create({
    data: { email: input.email, name: input.name, passwordHash: await hashPassword(input.password) },
    select: publicUserSelect,
  });
}

/** Returns the user for a correct email + password, else null. Runs a hash either way so timing doesn't reveal which emails exist. */
export async function authenticate(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));
  return user && ok ? { id: user.id, email: user.email, name: user.name } : null;
}

export async function updateAccount(userId: string, sessionId: string, input: UpdateAccountInput) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (input.email !== undefined || input.newPassword !== undefined) {
    const ok = await verifyPassword(input.currentPassword ?? "", user.passwordHash);
    if (!ok) throw badRequest("Your current password is incorrect.", "wrong_password");
  }
  if (input.email !== undefined && input.email !== user.email) {
    const taken = await prisma.user.findUnique({ where: { email: input.email } });
    if (taken) throw conflict("Another account already uses that email.", "email_taken");
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.newPassword !== undefined ? { passwordHash: await hashPassword(input.newPassword) } : {}),
    },
    select: publicUserSelect,
  });

  if (input.newPassword !== undefined) {
    // A password change signs out every other browser (e.g. after a suspected compromise).
    await prisma.session.deleteMany({ where: { userId, id: { not: sessionId } } });
  }
  return updated;
}

/**
 * Emails a single-use reset link. Always succeeds from the caller's point of
 * view, whether or not the email is registered, so the endpoint can't be used
 * to discover accounts.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;

  const token = generateToken();
  await prisma.passwordResetToken.create({
    data: { tokenHash: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
  });

  const link = `${config.appUrl}/reset-password/${token}`;
  await sendMail({
    to: user.email,
    subject: "Reset your Choresome password",
    text: [
      `Hi ${user.name},`,
      "",
      "Someone (hopefully you) asked to reset your Choresome password. Use this link within the next hour:",
      "",
      link,
      "",
      "If you didn't ask for this, you can ignore this email -- your password hasn't changed.",
    ].join("\n"),
  });
}

export async function resetPassword(token: string, newPassword: string) {
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
    throw new HttpError(400, "This reset link is invalid or has expired. Please request a new one.", "invalid_token");
  }

  return prisma.$transaction(async (tx) => {
    // Claim the token atomically so a link can't be used twice concurrently.
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) throw new HttpError(400, "This reset link has already been used.", "invalid_token");

    const user = await tx.user.update({
      where: { id: record.userId },
      data: { passwordHash: await hashPassword(newPassword) },
      select: publicUserSelect,
    });
    // Resetting a password signs out everywhere; the caller then starts a fresh session.
    await tx.session.deleteMany({ where: { userId: record.userId } });
    await tx.passwordResetToken.deleteMany({ where: { userId: record.userId, usedAt: null } });
    return user;
  });
}

/**
 * Deletes a login. Households the user solely owns are handed to the
 * longest-standing remaining member, or -- if nobody else is left -- deleted
 * along with all their data, so no household is ever left without an owner.
 */
export async function deleteAccount(userId: string, password: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(password, user.passwordHash))) {
    throw badRequest("Your password is incorrect.", "wrong_password");
  }

  const ownerships = await prisma.householdMembership.findMany({ where: { userId, role: "OWNER" } });
  for (const { householdId } of ownerships) {
    const otherOwners = await prisma.householdMembership.count({
      where: { householdId, role: "OWNER", userId: { not: userId } },
    });
    if (otherOwners > 0) continue;

    const successor = await prisma.householdMembership.findFirst({
      where: { householdId, userId: { not: userId } },
      orderBy: { createdAt: "asc" },
    });
    if (successor) {
      await prisma.householdMembership.update({ where: { id: successor.id }, data: { role: "OWNER" } });
    } else {
      await deleteHouseholdCompletely(householdId);
    }
  }

  // Memberships, sessions, invites and reset tokens cascade.
  await prisma.user.delete({ where: { id: userId } });
}
