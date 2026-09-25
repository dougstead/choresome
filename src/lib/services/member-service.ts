import { prisma } from "@/lib/db";
import type { CreateMemberInput, UpdateMemberInput } from "@/lib/validation/member";

/** Real household members. The system "Joint effort" member is never included. */
export async function listMembers(options: { includeInactive?: boolean } = {}) {
  return prisma.member.findMany({
    where: { isJoint: false, ...(options.includeInactive ? {} : { active: true }) },
    orderBy: { order: "asc" },
  });
}

/**
 * The single system member that "Joint effort" completions are recorded
 * against, created on first use. Keeping it a real Member row means history,
 * undo, dedupe, backups and NFC all work unchanged; stats expand it back out
 * to credit every real member.
 */
export async function getJointMember() {
  const existing = await prisma.member.findFirst({ where: { isJoint: true } });
  if (existing) return existing;
  return prisma.member.create({
    data: { name: "Joint effort", icon: "🤝", isJoint: true, order: 9999 },
  });
}

export async function createMember(input: CreateMemberInput) {
  const count = await prisma.member.count({ where: { isJoint: false } });
  return prisma.member.create({
    data: {
      name: input.name,
      icon: input.icon ?? "🙂",
      color: input.color,
      order: count,
    },
  });
}

export async function updateMember(id: string, input: UpdateMemberInput) {
  return prisma.member.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.order !== undefined ? { order: input.order } : {}),
    },
  });
}
