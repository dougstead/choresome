import { prisma } from "@/lib/db";
import type { CreateMemberInput, UpdateMemberInput } from "@/lib/validation/member";

export async function listMembers(options: { includeInactive?: boolean } = {}) {
  return prisma.member.findMany({
    where: options.includeInactive ? {} : { active: true },
    orderBy: { order: "asc" },
  });
}

export async function createMember(input: CreateMemberInput) {
  const count = await prisma.member.count();
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
