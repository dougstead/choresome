import type { MembershipRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { config } from "@/lib/config";
import { badRequest, conflict, forbidden, HttpError, notFound } from "@/lib/auth/errors";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { DEFAULT_REMINDER_CONFIG } from "@/lib/validation/recurrence";
import { DEFAULT_DISPLAY_CONFIG, type SetupInput } from "@/lib/validation/settings";
import { wipeHouseholdData } from "./tenant";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** A generous cap that stops one account creating households in a loop. */
const MAX_HOUSEHOLDS_PER_USER = 10;

/**
 * Creates a household from the setup wizard, makes `userId` its owner, and
 * seeds its members and areas -- all in one transaction, so a failure never
 * leaves a half-made household behind.
 */
export async function createHousehold(userId: string, input: SetupInput) {
  const existing = await prisma.householdMembership.count({ where: { userId } });
  if (existing >= MAX_HOUSEHOLDS_PER_USER) {
    throw conflict(`You can belong to at most ${MAX_HOUSEHOLDS_PER_USER} households.`, "household_limit");
  }

  return prisma.$transaction(async (tx) => {
    const household = await tx.household.create({
      data: {
        name: input.householdName,
        timezone: input.timezone,
        reminderDefaults: JSON.stringify(DEFAULT_REMINDER_CONFIG),
        displayConfig: JSON.stringify(DEFAULT_DISPLAY_CONFIG),
        setupCompleted: true,
      },
    });
    await tx.householdMembership.create({ data: { userId, householdId: household.id, role: "OWNER" } });

    const members = [];
    for (const [order, m] of input.members.entries()) {
      members.push(await tx.member.create({ data: { householdId: household.id, name: m.name, icon: m.icon ?? "🙂", order } }));
    }
    const areas = [];
    for (const [order, a] of input.areas.entries()) {
      areas.push(await tx.area.create({ data: { householdId: household.id, name: a.name, icon: a.icon ?? "🏠", order } }));
    }
    return { household, members, areas };
  });
}

export async function listUserHouseholds(userId: string) {
  const memberships = await prisma.householdMembership.findMany({
    where: { userId },
    include: { household: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map((m) => ({ id: m.household.id, name: m.household.name, role: m.role }));
}

export async function switchHousehold(sessionId: string, userId: string, householdId: number) {
  const membership = await prisma.householdMembership.findUnique({
    where: { userId_householdId: { userId, householdId } },
  });
  if (!membership) throw notFound("Household not found");
  await prisma.session.update({ where: { id: sessionId }, data: { householdId } });
}

export async function setSessionHousehold(sessionId: string, householdId: number) {
  await prisma.session.update({ where: { id: sessionId }, data: { householdId } });
}

// --- People with access (logins) -------------------------------------------

export async function listHouseholdUsers(householdId: number) {
  const memberships = await prisma.householdMembership.findMany({
    where: { householdId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map((m) => ({ userId: m.user.id, name: m.user.name, email: m.user.email, role: m.role, joinedAt: m.createdAt }));
}

async function ownerCount(householdId: number) {
  return prisma.householdMembership.count({ where: { householdId, role: "OWNER" } });
}

export async function changeMemberRole(householdId: number, targetUserId: string, role: MembershipRole) {
  const membership = await prisma.householdMembership.findUnique({
    where: { userId_householdId: { userId: targetUserId, householdId } },
  });
  if (!membership) throw notFound("That person isn't in this household.");
  if (membership.role === "OWNER" && role !== "OWNER" && (await ownerCount(householdId)) <= 1) {
    throw conflict("A household needs at least one owner. Make someone else an owner first.", "last_owner");
  }
  return prisma.householdMembership.update({ where: { id: membership.id }, data: { role } });
}

/** Removes someone's access (owner action), or -- when actor and target are the same -- leaves the household. */
export async function removeFromHousehold(householdId: number, actor: { userId: string; role: MembershipRole }, targetUserId: string) {
  const leaving = actor.userId === targetUserId;
  if (!leaving && actor.role !== "OWNER") throw forbidden();

  const membership = await prisma.householdMembership.findUnique({
    where: { userId_householdId: { userId: targetUserId, householdId } },
  });
  if (!membership) throw notFound("That person isn't in this household.");

  if (membership.role === "OWNER" && (await ownerCount(householdId)) <= 1) {
    const others = await prisma.householdMembership.count({ where: { householdId, userId: { not: targetUserId } } });
    throw conflict(
      others > 0
        ? "You're the only owner. Make someone else an owner before leaving."
        : "You're the only person in this household. Delete the household instead.",
      "last_owner"
    );
  }

  await prisma.$transaction([
    prisma.householdMembership.delete({ where: { id: membership.id } }),
    // Their browsers stop seeing this household straight away.
    prisma.session.updateMany({ where: { userId: targetUserId, householdId }, data: { householdId: null } }),
  ]);
}

// --- Invites ----------------------------------------------------------------

export async function createInvite(householdId: number, createdById: string, role: MembershipRole) {
  const token = generateToken();
  const invite = await prisma.invite.create({
    data: { tokenHash: hashToken(token), householdId, createdById, role, expiresAt: new Date(Date.now() + INVITE_TTL_MS) },
  });
  return { invite: serializeInvite(invite), url: `${config.appUrl}/invite/${token}` };
}

function serializeInvite(invite: { id: string; role: MembershipRole; expiresAt: Date; createdAt: Date }) {
  return { id: invite.id, role: invite.role, expiresAt: invite.expiresAt, createdAt: invite.createdAt };
}

/** Pending (unused, unrevoked, unexpired) invites. The link itself can't be shown again -- only its hash is stored. */
export async function listPendingInvites(householdId: number) {
  const invites = await prisma.invite.findMany({
    where: { householdId, usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  return invites.map(serializeInvite);
}

export async function revokeInvite(householdId: number, inviteId: string) {
  const result = await prisma.invite.updateMany({
    where: { id: inviteId, householdId, usedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count === 0) throw notFound("Invite not found");
}

async function findUsableInvite(token: string) {
  const invite = await prisma.invite.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { household: { select: { id: true, name: true } }, createdBy: { select: { name: true } } },
  });
  if (!invite || invite.usedAt || invite.revokedAt || invite.expiresAt.getTime() <= Date.now()) return null;
  return invite;
}

export async function getInvitePreview(token: string) {
  const invite = await findUsableInvite(token);
  if (!invite) return null;
  return { householdName: invite.household.name, invitedBy: invite.createdBy.name, role: invite.role, expiresAt: invite.expiresAt };
}

/** Joins the invite's household. Returns its id. Already being a member is fine (the invite is left unused). */
export async function acceptInvite(token: string, userId: string): Promise<number> {
  const invite = await findUsableInvite(token);
  if (!invite) throw new HttpError(410, "This invite link is invalid, used or expired. Ask for a new one.", "invalid_invite");

  const already = await prisma.householdMembership.findUnique({
    where: { userId_householdId: { userId, householdId: invite.householdId } },
  });
  if (already) return invite.householdId;

  const count = await prisma.householdMembership.count({ where: { userId } });
  if (count >= MAX_HOUSEHOLDS_PER_USER) {
    throw conflict(`You can belong to at most ${MAX_HOUSEHOLDS_PER_USER} households.`, "household_limit");
  }

  await prisma.$transaction(async (tx) => {
    // Claim atomically so a single-use link can't admit two people at once.
    const claimed = await tx.invite.updateMany({ where: { id: invite.id, usedAt: null }, data: { usedAt: new Date() } });
    if (claimed.count !== 1) throw new HttpError(410, "This invite link has already been used.", "invalid_invite");
    await tx.householdMembership.create({ data: { userId, householdId: invite.householdId, role: invite.role } });
  });
  return invite.householdId;
}

// --- Deletion ---------------------------------------------------------------

export async function deleteHouseholdCompletely(householdId: number) {
  await prisma.$transaction(async (tx) => {
    await wipeHouseholdData(tx, householdId);
    // Memberships, invites cascade; sessions pointing here are set to null.
    await tx.household.delete({ where: { id: householdId } });
  });
}

export async function deleteHousehold(householdId: number, confirmName: string) {
  const household = await prisma.household.findUnique({ where: { id: householdId } });
  if (!household) throw notFound("Household not found");
  if (household.name.trim() !== confirmName.trim()) {
    throw badRequest("Type the household's name exactly to confirm.", "confirm_mismatch");
  }
  await deleteHouseholdCompletely(householdId);
}
