import { prisma } from "@/lib/db";
import { notFound } from "@/lib/auth/errors";
import { reminderConfigSchema, type ReminderConfig } from "@/lib/validation/recurrence";
import { displayConfigSchema, type DisplayConfig, type UpdateSettingsInput } from "@/lib/validation/settings";

export interface HouseholdSettings {
  id: number;
  name: string;
  timezone: string;
  theme: "SYSTEM" | "LIGHT" | "DARK";
  dateFormat: string;
  timeFormat: string;
  upcomingWindowDays: number;
  reminderDefaults: ReminderConfig;
  displayConfig: DisplayConfig;
  holidayMode: boolean;
  holidayStartedAt: Date | null;
  setupCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function parseHousehold(row: {
  id: number;
  name: string;
  timezone: string;
  theme: string;
  dateFormat: string;
  timeFormat: string;
  upcomingWindowDays: number;
  reminderDefaults: string;
  displayConfig: string;
  holidayMode: boolean;
  holidayStartedAt: Date | null;
  setupCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}): HouseholdSettings {
  return {
    ...row,
    theme: row.theme as HouseholdSettings["theme"],
    reminderDefaults: reminderConfigSchema.parse(JSON.parse(row.reminderDefaults)),
    displayConfig: displayConfigSchema.parse(JSON.parse(row.displayConfig)),
  };
}

export async function getHouseholdSettings(householdId: number): Promise<HouseholdSettings> {
  const row = await prisma.household.findUnique({ where: { id: householdId } });
  if (!row) throw notFound("Household not found");
  return parseHousehold(row);
}

export async function updateHouseholdSettings(householdId: number, input: UpdateSettingsInput): Promise<HouseholdSettings> {
  const row = await prisma.household.update({
    where: { id: householdId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
      ...(input.theme !== undefined ? { theme: input.theme } : {}),
      ...(input.dateFormat !== undefined ? { dateFormat: input.dateFormat } : {}),
      ...(input.timeFormat !== undefined ? { timeFormat: input.timeFormat } : {}),
      ...(input.upcomingWindowDays !== undefined ? { upcomingWindowDays: input.upcomingWindowDays } : {}),
      ...(input.reminderDefaults !== undefined ? { reminderDefaults: JSON.stringify(input.reminderDefaults) } : {}),
      ...(input.displayConfig !== undefined ? { displayConfig: JSON.stringify(input.displayConfig) } : {}),
    },
  });
  return parseHousehold(row);
}
