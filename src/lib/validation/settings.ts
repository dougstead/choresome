import { z } from "zod";
import { reminderConfigSchema } from "./recurrence";

export const themeSchema = z.enum(["SYSTEM", "LIGHT", "DARK"]);

export const displayConfigSchema = z.object({
  idleTimeoutSeconds: z.number().int().min(15).max(3600),
  sharedMode: z.boolean(),
  screensaverBrightness: z.number().min(0).max(1),
});

export type DisplayConfig = z.infer<typeof displayConfigSchema>;

export const DEFAULT_DISPLAY_CONFIG: DisplayConfig = {
  idleTimeoutSeconds: 90,
  sharedMode: true,
  screensaverBrightness: 0.4,
};

export const updateSettingsSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
  theme: themeSchema.optional(),
  dateFormat: z.string().trim().min(1).max(20).optional(),
  timeFormat: z.enum(["12h", "24h"]).optional(),
  upcomingWindowDays: z.number().int().min(1).max(30).optional(),
  reminderDefaults: reminderConfigSchema.optional(),
  backupDir: z.string().trim().max(500).nullable().optional(),
  backupRetention: z.number().int().min(1).max(365).optional(),
  backupIntervalHours: z.number().int().min(1).max(168).optional(),
  displayConfig: displayConfigSchema.optional(),
  setupCompleted: z.boolean().optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export const setupSchema = z.object({
  householdName: z.string().trim().min(1).max(80),
  timezone: z.string().trim().min(1).max(80),
  members: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        icon: z.string().trim().min(1).max(8).optional(),
      })
    )
    .min(1)
    .max(10),
  areas: z.array(z.object({ name: z.string().trim().min(1).max(60), icon: z.string().trim().min(1).max(8).optional() })).max(20),
});

export type SetupInput = z.infer<typeof setupSchema>;
