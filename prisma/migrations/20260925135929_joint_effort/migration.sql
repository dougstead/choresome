-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '🙂',
    "color" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isJoint" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Member" ("active", "color", "createdAt", "icon", "id", "name", "order", "updatedAt") SELECT "active", "color", "createdAt", "icon", "id", "name", "order", "updatedAt" FROM "Member";
DROP TABLE "Member";
ALTER TABLE "new_Member" RENAME TO "Member";
CREATE INDEX "Member_active_order_idx" ON "Member"("active", "order");
CREATE TABLE "new_Task" (
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
    "allowJoint" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Task_defaultAssigneeId_fkey" FOREIGN KEY ("defaultAssigneeId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("active", "archivedAt", "areaId", "createdAt", "defaultAssigneeId", "description", "dueDate", "estimatedDurationMinutes", "icon", "id", "name", "priority", "recurrenceConfig", "recurrenceType", "reminderConfig", "updatedAt") SELECT "active", "archivedAt", "areaId", "createdAt", "defaultAssigneeId", "description", "dueDate", "estimatedDurationMinutes", "icon", "id", "name", "priority", "recurrenceConfig", "recurrenceType", "reminderConfig", "updatedAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE INDEX "Task_areaId_idx" ON "Task"("areaId");
CREATE INDEX "Task_active_dueDate_idx" ON "Task"("active", "dueDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
