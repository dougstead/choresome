-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Household" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/London',
    "theme" TEXT NOT NULL DEFAULT 'SYSTEM',
    "dateFormat" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
    "timeFormat" TEXT NOT NULL DEFAULT '24h',
    "upcomingWindowDays" INTEGER NOT NULL DEFAULT 3,
    "reminderDefaults" TEXT NOT NULL DEFAULT '{"onDue":true,"onOverdue":true,"daysBefore":[],"hoursBefore":[]}',
    "backupDir" TEXT,
    "backupRetention" INTEGER NOT NULL DEFAULT 14,
    "backupIntervalHours" INTEGER NOT NULL DEFAULT 24,
    "displayConfig" TEXT NOT NULL DEFAULT '{"idleTimeoutSeconds":90,"sharedMode":true,"screensaverBrightness":0.4}',
    "holidayMode" BOOLEAN NOT NULL DEFAULT false,
    "holidayStartedAt" DATETIME,
    "setupCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Household" ("backupDir", "backupIntervalHours", "backupRetention", "createdAt", "dateFormat", "displayConfig", "id", "name", "reminderDefaults", "setupCompleted", "theme", "timeFormat", "timezone", "upcomingWindowDays", "updatedAt") SELECT "backupDir", "backupIntervalHours", "backupRetention", "createdAt", "dateFormat", "displayConfig", "id", "name", "reminderDefaults", "setupCompleted", "theme", "timeFormat", "timezone", "upcomingWindowDays", "updatedAt" FROM "Household";
DROP TABLE "Household";
ALTER TABLE "new_Household" RENAME TO "Household";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
