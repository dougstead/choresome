import { prisma } from "@/lib/db";
import type { CreateAreaInput, UpdateAreaInput } from "@/lib/validation/area";

export async function listAreas(options: { includeArchived?: boolean } = {}) {
  return prisma.area.findMany({
    where: options.includeArchived ? {} : { archived: false },
    orderBy: { order: "asc" },
  });
}

export async function createArea(input: CreateAreaInput) {
  const count = await prisma.area.count();
  return prisma.area.create({
    data: { name: input.name, icon: input.icon ?? "🏠", order: count },
  });
}

export async function updateArea(id: string, input: UpdateAreaInput) {
  return prisma.area.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
      ...(input.archived !== undefined ? { archived: input.archived } : {}),
      ...(input.order !== undefined ? { order: input.order } : {}),
    },
  });
}
