-- CreateTable
CREATE TABLE "Household" (
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
    "setupCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '🙂',
    "color" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '🏠',
    "order" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "shortId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Task_defaultAssigneeId_fkey" FOREIGN KEY ("defaultAssigneeId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompletionEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "completedAt" DATETIME NOT NULL,
    "note" TEXT,
    "dueDateAtCompletion" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CompletionEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompletionEvent_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Member_active_order_idx" ON "Member"("active", "order");

-- CreateIndex
CREATE INDEX "Area_archived_order_idx" ON "Area"("archived", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Task_shortId_key" ON "Task"("shortId");

-- CreateIndex
CREATE INDEX "Task_areaId_idx" ON "Task"("areaId");

-- CreateIndex
CREATE INDEX "Task_active_dueDate_idx" ON "Task"("active", "dueDate");

-- CreateIndex
CREATE INDEX "CompletionEvent_taskId_completedAt_idx" ON "CompletionEvent"("taskId", "completedAt");

-- CreateIndex
CREATE INDEX "CompletionEvent_memberId_completedAt_idx" ON "CompletionEvent"("memberId", "completedAt");

-- CreateIndex
CREATE INDEX "CompletionEvent_completedAt_idx" ON "CompletionEvent"("completedAt");
