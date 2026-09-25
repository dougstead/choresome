import { prisma } from "@/lib/db";
import { DEFAULT_REMINDER_CONFIG, reminderConfigSchema, type ReminderConfig } from "@/lib/validation/recurrence";
import { DEFAULT_DISPLAY_CONFIG, displayConfigSchema, type DisplayConfig, type UpdateSettingsInput } from "@/lib/validation/settings";

const HOUSEHOLD_ID = 1;

export interface HouseholdSettings {
  id: number;
  name: string;
  timezone: string;
  theme: "SYSTEM" | "LIGHT" | "DARK";
  dateFormat: string;
  timeFormat: string;
  upcomingWindowDays: number;
  reminderDefaults: ReminderConfig;
  backupDir: string | null;
  backupRetention: number;
  backupIntervalHours: number;
  displayConfig: DisplayConfig;
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
  backupDir: string | null;
  backupRetention: number;
  backupIntervalHours: number;
  displayConfig: string;
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

/** Fetches the household settings singleton, creating it with sensible defaults on first run. */
export async function getHouseholdSettings(): Promise<HouseholdSettings> {
  const row = await prisma.household.upsert({
    where: { id: HOUSEHOLD_ID },
    update: {},
    create: {
      id: HOUSEHOLD_ID,
      name: "Our Household",
      reminderDefaults: JSON.stringify(DEFAULT_REMINDER_CONFIG),
      displayConfig: JSON.stringify(DEFAULT_DISPLAY_CONFIG),
    },
  });
  return parseHousehold(row);
}

export async function updateHouseholdSettings(input: UpdateSettingsInput): Promise<HouseholdSettings> {
  await getHouseholdSettings(); // ensure the row exists
  const row = await prisma.household.update({
    where: { id: HOUSEHOLD_ID },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
      ...(input.theme !== undefined ? { theme: input.theme } : {}),
      ...(input.dateFormat !== undefined ? { dateFormat: input.dateFormat } : {}),
      ...(input.timeFormat !== undefined ? { timeFormat: input.timeFormat } : {}),
      ...(input.upcomingWindowDays !== undefined ? { upcomingWindowDays: input.upcomingWindowDays } : {}),
      ...(input.reminderDefaults !== undefined ? { reminderDefaults: JSON.stringify(input.reminderDefaults) } : {}),
      ...(input.backupDir !== undefined ? { backupDir: input.backupDir } : {}),
      ...(input.backupRetention !== undefined ? { backupRetention: input.backupRetention } : {}),
      ...(input.backupIntervalHours !== undefined ? { backupIntervalHours: input.backupIntervalHours } : {}),
      ...(input.displayConfig !== undefined ? { displayConfig: JSON.stringify(input.displayConfig) } : {}),
      ...(input.setupCompleted !== undefined ? { setupCompleted: input.setupCompleted } : {}),
    },
  });
  return parseHousehold(row);
}
