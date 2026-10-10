-- Multi-household split.
--
-- Every household-owned table gains a required householdId. Rows that already
-- exist belonged to the old single-household singleton (Household.id = 1), so
-- they're backfilled to household 1 -- which is created first if an older
-- install has chore data but somehow no Household row. An upgraded install
-- then has exactly one household with no users; claim it with
-- `npm run admin -- claim-household --email you@example.com`.
--
-- The per-household backupDir/backupRetention/backupIntervalHours settings
-- are dropped: in a hosted service, a household must never be able to choose
-- a filesystem path on the server. Server-wide backups are configured by
-- environment variables instead (see .env.example).

INSERT INTO "Household" ("id", "name", "updatedAt")
SELECT 1, 'Our Household', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Household" WHERE "id" = 1)
  AND (EXISTS (SELECT 1 FROM "Member") OR EXISTS (SELECT 1 FROM "Area") OR EXISTS (SELECT 1 FROM "Task"));

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "HouseholdMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "householdId" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HouseholdMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HouseholdMembership_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "householdId" INTEGER,
    "expiresAt" DATETIME NOT NULL,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Session_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "householdId" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "createdById" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invite_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Area" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '🏠',
    "order" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Area_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Area" ("archived", "createdAt", "icon", "id", "name", "order", "updatedAt", "householdId") SELECT "archived", "createdAt", "icon", "id", "name", "order", "updatedAt", 1 FROM "Area";
DROP TABLE "Area";
ALTER TABLE "new_Area" RENAME TO "Area";
CREATE INDEX "Area_householdId_archived_order_idx" ON "Area"("householdId", "archived", "order");
CREATE TABLE "new_CompletionEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" INTEGER NOT NULL,
    "taskId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "completedAt" DATETIME NOT NULL,
    "note" TEXT,
    "dueDateAtCompletion" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CompletionEvent_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompletionEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompletionEvent_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_CompletionEvent" ("completedAt", "createdAt", "dueDateAtCompletion", "id", "memberId", "note", "taskId", "updatedAt", "householdId") SELECT "completedAt", "createdAt", "dueDateAtCompletion", "id", "memberId", "note", "taskId", "updatedAt", 1 FROM "CompletionEvent";
DROP TABLE "CompletionEvent";
ALTER TABLE "new_CompletionEvent" RENAME TO "CompletionEvent";
CREATE INDEX "CompletionEvent_taskId_completedAt_idx" ON "CompletionEvent"("taskId", "completedAt");
CREATE INDEX "CompletionEvent_memberId_completedAt_idx" ON "CompletionEvent"("memberId", "completedAt");
CREATE INDEX "CompletionEvent_householdId_completedAt_idx" ON "CompletionEvent"("householdId", "completedAt");
CREATE TABLE "new_Household" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/London',
    "theme" TEXT NOT NULL DEFAULT 'SYSTEM',
    "dateFormat" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
    "timeFormat" TEXT NOT NULL DEFAULT '24h',
    "upcomingWindowDays" INTEGER NOT NULL DEFAULT 3,
    "reminderDefaults" TEXT NOT NULL DEFAULT '{"onDue":true,"onOverdue":true,"daysBefore":[],"hoursBefore":[]}',
    "displayConfig" TEXT NOT NULL DEFAULT '{"idleTimeoutSeconds":90,"sharedMode":true,"screensaverBrightness":0.4}',
    "holidayMode" BOOLEAN NOT NULL DEFAULT false,
    "holidayStartedAt" DATETIME,
    "setupCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Household" ("createdAt", "dateFormat", "displayConfig", "holidayMode", "holidayStartedAt", "id", "name", "reminderDefaults", "setupCompleted", "theme", "timeFormat", "timezone", "upcomingWindowDays", "updatedAt") SELECT "createdAt", "dateFormat", "displayConfig", "holidayMode", "holidayStartedAt", "id", "name", "reminderDefaults", "setupCompleted", "theme", "timeFormat", "timezone", "upcomingWindowDays", "updatedAt" FROM "Household";
DROP TABLE "Household";
ALTER TABLE "new_Household" RENAME TO "Household";
CREATE TABLE "new_Member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '🙂',
    "color" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isJoint" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Member_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Member" ("active", "color", "createdAt", "icon", "id", "isJoint", "name", "order", "updatedAt", "householdId") SELECT "active", "color", "createdAt", "icon", "id", "isJoint", "name", "order", "updatedAt", 1 FROM "Member";
DROP TABLE "Member";
ALTER TABLE "new_Member" RENAME TO "Member";
CREATE INDEX "Member_householdId_active_order_idx" ON "Member"("householdId", "active", "order");
CREATE TABLE "new_NfcTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "householdId" INTEGER NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "taskId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NfcTag_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NfcTag_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_NfcTag" ("active", "createdAt", "id", "label", "lastUsedAt", "taskId", "token", "updatedAt", "householdId") SELECT "active", "createdAt", "id", "label", "lastUsedAt", "taskId", "token", "updatedAt", 1 FROM "NfcTag";
DROP TABLE "NfcTag";
ALTER TABLE "new_NfcTag" RENAME TO "NfcTag";
CREATE UNIQUE INDEX "NfcTag_token_key" ON "NfcTag"("token");
CREATE INDEX "NfcTag_taskId_idx" ON "NfcTag"("taskId");
CREATE INDEX "NfcTag_householdId_idx" ON "NfcTag"("householdId");
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "areaId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" DATETIME,
    "recurrenceType" TEXT NOT NULL,
    "recurrenceConfig" TEXT NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "reminderConfig" TEXT,
    "defaultAssigneeId" TEXT,
    "estimatedDurationMinutes" INTEGER,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "icon" TEXT NOT NULL DEFAULT '🧽',
    "allowJoint" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Task_defaultAssigneeId_fkey" FOREIGN KEY ("defaultAssigneeId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("active", "allowJoint", "archivedAt", "areaId", "createdAt", "defaultAssigneeId", "description", "dueDate", "estimatedDurationMinutes", "icon", "id", "name", "priority", "recurrenceConfig", "recurrenceType", "reminderConfig", "updatedAt", "householdId") SELECT "active", "allowJoint", "archivedAt", "areaId", "createdAt", "defaultAssigneeId", "description", "dueDate", "estimatedDurationMinutes", "icon", "id", "name", "priority", "recurrenceConfig", "recurrenceType", "reminderConfig", "updatedAt", 1 FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE INDEX "Task_areaId_idx" ON "Task"("areaId");
CREATE INDEX "Task_householdId_active_dueDate_idx" ON "Task"("householdId", "active", "dueDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "HouseholdMembership_householdId_idx" ON "HouseholdMembership"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "HouseholdMembership_userId_householdId_key" ON "HouseholdMembership"("userId", "householdId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_tokenHash_key" ON "Invite"("tokenHash");

-- CreateIndex
CREATE INDEX "Invite_householdId_idx" ON "Invite"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
