import { notFound } from "next/navigation";
import { TaskDetail } from "@/components/task-detail";
import { serializeTask } from "@/lib/api/serialize-task";
import { calendarDateToIsoDate, instantToCalendarDate } from "@/lib/dates";
import { getTaskById } from "@/lib/services/task-service";
import { getHouseholdSettings } from "@/lib/services/settings-service";

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [task, settings] = await Promise.all([getTaskById(id), getHouseholdSettings()]);
  if (!task) notFound();

  const todayIso = calendarDateToIsoDate(instantToCalendarDate(new Date(), settings.timezone));

  return (
    <TaskDetail
      task={serializeTask(task)}
      todayIso={todayIso}
      upcomingWindowDays={settings.upcomingWindowDays}
      dateFormat={settings.dateFormat}
    />
  );
}
