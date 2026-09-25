import Link from "next/link";
import { AddAreaButton } from "@/components/add-area-button";
import { calendarDateToIsoDate, instantToCalendarDate } from "@/lib/dates";
import { getTaskStatus } from "@/lib/task-status";
import { listAreas } from "@/lib/services/area-service";
import { listTasks } from "@/lib/services/task-service";
import { getHouseholdSettings } from "@/lib/services/settings-service";
import { serializeTask } from "@/lib/api/serialize-task";

export default async function AreasPage() {
  const [areas, tasks, settings] = await Promise.all([listAreas(), listTasks(), getHouseholdSettings()]);
  const todayIso = calendarDateToIsoDate(instantToCalendarDate(new Date(), settings.timezone));

  const tasksByArea = new Map<string, ReturnType<typeof serializeTask>[]>();
  for (const task of tasks) {
    const serialized = serializeTask(task);
    const list = tasksByArea.get(task.areaId) ?? [];
    list.push(serialized);
    tasksByArea.set(task.areaId, list);
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold">Areas</h1>
      <div className="space-y-3">
        {areas.map((area) => {
          const areaTasks = tasksByArea.get(area.id) ?? [];
          const overdueCount = areaTasks.filter(
            (t) => getTaskStatus(t.dueDate, todayIso, settings.upcomingWindowDays).status === "overdue"
          ).length;
          return (
            <Link
              key={area.id}
              href={`/areas/${area.id}`}
              className="flex items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-sm"
            >
              <span className="text-3xl">{area.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-extrabold">{area.name}</span>
                <span className="text-xs text-text-muted">
                  {areaTasks.length} task{areaTasks.length === 1 ? "" : "s"}
                </span>
              </span>
              {overdueCount > 0 ? (
                <span
                  className="rounded-full px-2.5 py-1 text-xs font-bold"
                  style={{ backgroundColor: "var(--color-overdue-soft)", color: "var(--color-overdue)" }}
                >
                  {overdueCount} overdue
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
      <AddAreaButton />
    </div>
  );
}
