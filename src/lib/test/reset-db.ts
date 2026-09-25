import { prisma } from "@/lib/db";

/** Clears all rows between integration tests, in FK-safe order. Test DB only. */
export async function resetDb(): Promise<void> {
  await prisma.nfcTag.deleteMany();
  await prisma.completionEvent.deleteMany();
  await prisma.task.deleteMany();
  await prisma.area.deleteMany();
  await prisma.member.deleteMany();
  await prisma.household.deleteMany();
}
