import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { badRequest, notFound } from "@/lib/auth/errors";

/**
 * Ownership checks for ids that arrive from the client. Every service looks
 * rows up by `{ id, householdId }`, never by id alone, and every *reference*
 * to another row (a task's area, a completion's member, a tag's task) is
 * checked here before it's written -- so one household can never read,
 * change, or attach itself to another household's data, even by guessing ids.
 *
 * A row in someone else's household is reported exactly like a missing row.
 */

type Db = Prisma.TransactionClient | typeof prisma;

export async function findTaskOrThrow(householdId: number, id: string, db: Db = prisma) {
  const task = await db.task.findFirst({ where: { id, householdId } });
  if (!task) throw notFound("Task not found");
  return task;
}

export async function findAreaOrThrow(householdId: number, id: string, db: Db = prisma) {
  const area = await db.area.findFirst({ where: { id, householdId } });
  if (!area) throw notFound("Area not found");
  return area;
}

export async function findMemberOrThrow(householdId: number, id: string, db: Db = prisma) {
  const member = await db.member.findFirst({ where: { id, householdId } });
  if (!member) throw notFound("Member not found");
  return member;
}

/** For ids embedded in a request body: a foreign id is a bad request, not a 404 on the URL's resource. */
export async function assertAreaInHousehold(householdId: number, areaId: string, db: Db = prisma) {
  const area = await db.area.findFirst({ where: { id: areaId, householdId }, select: { id: true } });
  if (!area) throw badRequest("Unknown area", "invalid_area");
}

export async function assertMemberInHousehold(householdId: number, memberId: string, db: Db = prisma) {
  const member = await db.member.findFirst({ where: { id: memberId, householdId }, select: { id: true } });
  if (!member) throw badRequest("Unknown member", "invalid_member");
}

export async function assertTaskInHousehold(householdId: number, taskId: string, db: Db = prisma) {
  const task = await db.task.findFirst({ where: { id: taskId, householdId }, select: { id: true } });
  if (!task) throw badRequest("Unknown task", "invalid_task");
}

/** Deletes every chore row belonging to a household, in foreign-key-safe order. Leaves the Household row and its users alone. */
export async function wipeHouseholdData(tx: Prisma.TransactionClient, householdId: number) {
  await tx.nfcTag.deleteMany({ where: { householdId } });
  await tx.completionEvent.deleteMany({ where: { householdId } });
  await tx.task.deleteMany({ where: { householdId } });
  await tx.area.deleteMany({ where: { householdId } });
  await tx.member.deleteMany({ where: { householdId } });
}
