import { prisma } from "@/lib/db";
import { resetRateLimits } from "@/lib/auth/rate-limit";
import { DEFAULT_REMINDER_CONFIG } from "@/lib/validation/recurrence";
import { DEFAULT_DISPLAY_CONFIG } from "@/lib/validation/settings";

/** Clears all rows between integration tests, in FK-safe order. Test DB only. */
export async function resetDb(): Promise<void> {
  await prisma.nfcTag.deleteMany();
  await prisma.completionEvent.deleteMany();
  await prisma.task.deleteMany();
  await prisma.area.deleteMany();
  await prisma.member.deleteMany();
  await prisma.session.deleteMany();
  await prisma.invite.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.householdMembership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.household.deleteMany();
  resetRateLimits();
}

/** A bare, set-up household to run service tests against. Returns its id. */
export async function createTestHousehold(name = "Test Household"): Promise<number> {
  const household = await prisma.household.create({
    data: {
      name,
      timezone: "Europe/London",
      reminderDefaults: JSON.stringify(DEFAULT_REMINDER_CONFIG),
      displayConfig: JSON.stringify(DEFAULT_DISPLAY_CONFIG),
      setupCompleted: true,
    },
  });
  return household.id;
}
