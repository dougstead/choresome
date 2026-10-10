import { notFound } from "next/navigation";
import { TaskDetail } from "@/components/task-detail";
import { serializeTask } from "@/lib/api/serialize-task";
import { householdTodayIso } from "@/lib/household-clock";
import { getTaskById } from "@/lib/services/task-service";
import { getHouseholdSettings } from "@/lib/services/settings-service";
import { requirePageHousehold } from "@/lib/auth/context";

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { householdId } = await requirePageHousehold();
  const [task, settings] = await Promise.all([getTaskById(householdId, id), getHouseholdSettings(householdId)]);
  if (!task) notFound();

  const todayIso = householdTodayIso(settings);

  return (
    <TaskDetail
      task={serializeTask(task)}
      todayIso={todayIso}
      upcomingWindowDays={settings.upcomingWindowDays}
      dateFormat={settings.dateFormat}
    />
  );
}
